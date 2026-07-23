import { NotificationProps } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums";

export interface ChannelSender {
  channel: Channel;
  send(input: {
    notificationId: string;
    recipient: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface EventPayload {
  id: string;
  type: string;
  source: string;
  time: string;
  data: unknown;
}

export interface EventPublisher {
  publish(event: EventPayload): Promise<void>;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface NotificationRepository {
  save(notification: NotificationProps): Promise<void>;
  findById(id: string): Promise<NotificationProps | null>;
  findAll(): Promise<NotificationProps[]>;
}

export interface RetryQueue {
  enqueue(message: Record<string, unknown>): Promise<void>;
}
