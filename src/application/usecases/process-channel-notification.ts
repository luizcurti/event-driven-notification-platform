import { Notification } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums/channel";
import { Logger } from "../ports/logger";
import { NotificationRepository } from "../ports/notification-repository";
import { RetryQueue } from "../ports/retry-queue";
import { ChannelSender } from "../ports/channel-sender";

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

    const processing = new Notification(current).markProcessing().toJSON();
    await this.repository.save(processing);

    try {
      await this.sender.send({
        notificationId: input.notificationId,
        recipient: input.recipient,
        payload: input.payload,
      });

      const delivered = new Notification(processing).markDelivered().toJSON();
      await this.repository.save(delivered);

      this.logger.info("delivery-success", {
        notificationId: input.notificationId,
        channel: input.channel,
      });
    } catch (error) {
      const retrying = new Notification(processing).markRetrying().toJSON();
      await this.repository.save(retrying);
      await this.retryQueue.enqueue({
        ...input,
        retryCount: retrying.retryCount,
      });

      this.logger.error("delivery-failed", {
        notificationId: input.notificationId,
        channel: input.channel,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
