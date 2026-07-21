import { Notification } from "../../domain/entities/notification";
import { NotFoundError } from "../../domain/errors/not-found-error";
import { Logger } from "../ports/logger";
import { NotificationRepository } from "../ports/notification-repository";

export class CancelNotificationUseCase {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string) {
    const current = await this.repository.findById(id);

    if (!current) {
      throw new NotFoundError(`notification ${id} not found`);
    }

    const canceled = new Notification(current).cancel().toJSON();
    await this.repository.save(canceled);

    this.logger.info("notification-canceled", { notificationId: id });

    return canceled;
  }
}
