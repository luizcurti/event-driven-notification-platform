import { NotificationProps } from "../../domain/entities/notification";

export interface NotificationRepository {
  save(notification: NotificationProps): Promise<void>;
  findById(id: string): Promise<NotificationProps | null>;
  findAll(): Promise<NotificationProps[]>;
}
