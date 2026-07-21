import { NotFoundError } from "../../domain/errors/not-found-error";
import { NotificationRepository } from "../ports/notification-repository";

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
