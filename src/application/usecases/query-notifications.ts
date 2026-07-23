import { NotFoundError } from "../../domain/errors";
import { NotificationRepository } from "../ports";

export class GetNotificationUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(id: string) {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new NotFoundError(`notification ${id} not found`);
    }

    return notification;
  }
}

export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute() {
    return this.repository.findAll();
  }
}
