import { Notification } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums";
import { ChannelSender, Logger, NotificationRepository, RetryQueue } from "../ports";

interface ProcessChannelInput {
  notificationId: string;
  recipient: string;
  payload: Record<string, unknown>;
  channel: Channel;
}

export class ProcessChannelNotificationUseCase {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly sender: ChannelSender,
    private readonly retryQueue: RetryQueue,
    private readonly logger: Logger,
  ) {}

  async execute(input: ProcessChannelInput): Promise<void> {
    const current = await this.repository.findById(input.notificationId);

    if (!current) {
      this.logger.error("notification-not-found-for-channel", {
        notificationId: input.notificationId,
        channel: input.channel,
      });
      return;
    }

    const notification = new Notification(current);
    await this.repository.updateChannelState(
      input.notificationId,
      input.channel,
      notification.markChannelProcessing(input.channel).channelState(input.channel),
    );

    try {
      await this.sender.send({
        notificationId: input.notificationId,
        recipient: input.recipient,
        payload: input.payload,
      });

      await this.repository.updateChannelState(
        input.notificationId,
        input.channel,
        notification.markChannelDelivered(input.channel).channelState(input.channel),
      );

      this.logger.info("delivery-success", {
        notificationId: input.notificationId,
        channel: input.channel,
      });
    } catch (error) {
      const retryingState = notification
        .markChannelRetrying(input.channel)
        .channelState(input.channel);
      await this.repository.updateChannelState(input.notificationId, input.channel, retryingState);

      await this.retryQueue.enqueue({
        notificationId: input.notificationId,
        recipient: input.recipient,
        payload: input.payload,
        channel: input.channel,
        retryCount: retryingState.retryCount,
      });

      this.logger.error("delivery-failed", {
        notificationId: input.notificationId,
        channel: input.channel,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
