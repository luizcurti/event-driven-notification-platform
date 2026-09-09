import { Notification } from "../../domain/entities/notification";
import { NotFoundError } from "../../domain/errors";
import { FindAllOptions, NotificationRepository } from "../ports";

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

  async execute(options?: FindAllOptions) {
    const page = await this.repository.findAll(options);
    return {
      items: page.items.map((notification) => new Notification(notification).toJSON()),
      nextCursor: page.nextCursor,
    };
  }
}
