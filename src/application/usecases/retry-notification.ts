import { Channel } from "../../domain/enums/channel";
import { EventPublisher } from "../ports/event-publisher";
import { Logger } from "../ports/logger";

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
    private readonly logger: Logger,
    private readonly maxRetries = 3,
  ) {}

  async execute(input: RetryInput): Promise<void> {
    if (input.retryCount > this.maxRetries) {
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
}
