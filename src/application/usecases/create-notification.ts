import { Notification, type CreateNotificationInput } from "../../domain/entities/notification";
import { NotificationStatus } from "../../domain/enums/notification-status";
import { EventPublisher } from "../ports/event-publisher";
import { Logger } from "../ports/logger";
import { NotificationRepository } from "../ports/notification-repository";

interface CreateNotificationResult {
  id: string;
  status: NotificationStatus;
}

export class CreateNotificationUseCase {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly publisher: EventPublisher,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateNotificationInput): Promise<CreateNotificationResult> {
    const notification = Notification.create(input);
    const data = notification.toJSON();

    await this.repository.save(data);

    await this.publisher.publish({
      id: data.id,
      type: data.eventType,
      source: "notification-api",
      time: data.createdAt,
      data,
    });

    this.logger.info("notification-created", {
      notificationId: data.id,
      eventType: data.eventType,
    });

    this.logger.info("event-published", {
      notificationId: data.id,
      eventType: data.eventType,
    });

    return { id: data.id, status: data.status };
  }
}
