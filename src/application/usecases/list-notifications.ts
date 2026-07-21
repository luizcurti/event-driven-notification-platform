import { NotificationRepository } from "../ports/notification-repository";

export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute() {
    return this.repository.findAll();
  }
}
