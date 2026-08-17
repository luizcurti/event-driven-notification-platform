import { Notification } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums";
import { EventPublisher, Logger, NotificationRepository } from "../ports";

interface RetryInput {
  notificationId: string;
  recipient: string;
  payload: Record<string, unknown>;
  channel: Channel;
  retryCount: number;
}

export class RetryNotificationUseCase {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly repository: NotificationRepository,
    private readonly logger: Logger,
    private readonly maxRetries = 3,
  ) {}

  async execute(input: RetryInput): Promise<void> {
    if (input.retryCount > this.maxRetries) {
      await this.markChannelFailed(input);

      this.logger.error("retry-limit-reached", {
        notificationId: input.notificationId,
        channel: input.channel,
      });
      return;
    }

    await this.publisher.publish({
      id: input.notificationId,
      type: "NotificationRequested",
      source: "retry-worker",
      time: new Date().toISOString(),
      data: {
        id: input.notificationId,
        recipient: input.recipient,
        payload: input.payload,
        channels: [input.channel],
      },
    });

    this.logger.info("retry-published", {
      notificationId: input.notificationId,
      channel: input.channel,
      retryCount: input.retryCount,
    });
  }

  private async markChannelFailed(input: RetryInput): Promise<void> {
    const current = await this.repository.findById(input.notificationId);

    if (!current) {
      return;
    }

    const failed = new Notification(current).markChannelFailed(input.channel);
    await this.repository.updateChannelState(
      input.notificationId,
      input.channel,
      failed.channelState(input.channel),
    );
  }
}
