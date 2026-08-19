import { Notification } from "../../domain/entities/notification";
import { NotificationStatus } from "../../domain/enums";
import { DomainError, NotFoundError } from "../../domain/errors";
import { Logger, Metrics, NotificationRepository } from "../ports";

export class CancelNotificationUseCase {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly logger: Logger,
    private readonly metrics?: Metrics,
  ) {}

  async execute(id: string) {
    const current = await this.repository.findById(id);

    if (!current) {
      throw new NotFoundError(`notification ${id} not found`);
    }

    const notification = new Notification(current);

    if (notification.status === NotificationStatus.CANCELED) {
      throw new DomainError(`notification ${id} is already canceled`);
    }

    if (notification.status === NotificationStatus.DELIVERED) {
      throw new DomainError(`notification ${id} was already delivered and cannot be canceled`);
    }

    const canceled = notification.cancel().toJSON();
    await this.repository.markCanceled(id, canceled.canceledAt as string);

    this.logger.info("notification-canceled", { notificationId: id });

    this.metrics?.notificationCanceled();

    return canceled;
  }
}
