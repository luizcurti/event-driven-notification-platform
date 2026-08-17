import { Notification } from "../../domain/entities/notification";
import { NotFoundError } from "../../domain/errors";
import { NotificationRepository } from "../ports";

export class GetNotificationUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(id: string) {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new NotFoundError(`notification ${id} not found`);
    }

    return new Notification(notification).toJSON();
  }
}

export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute() {
    const notifications = await this.repository.findAll();
    return notifications.map((notification) => new Notification(notification).toJSON());
  }
}
