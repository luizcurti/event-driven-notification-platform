import { randomUUID } from "node:crypto";
import { ALLOWED_CHANNELS, Channel, NotificationStatus } from "../enums";
import { DomainError } from "../errors";

export interface NotificationProps {
  id: string;
  eventType: string;
  recipient: string;
  channels: Channel[];
  payload: Record<string, unknown>;
  status: NotificationStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
}

export interface CreateNotificationInput {
  eventType: string;
  recipient: string;
  channels: string[];
  payload: Record<string, unknown>;
}

export class Notification {
  constructor(private readonly props: NotificationProps) {}

  static create(input: CreateNotificationInput): Notification {
    if (!input.eventType || input.eventType.trim().length === 0) {
      throw new DomainError("eventType is required");
    }

    if (!input.recipient || input.recipient.trim().length === 0) {
      throw new DomainError("recipient is required");
    }

    if (!Array.isArray(input.channels) || input.channels.length === 0) {
      throw new DomainError("channels must have at least one value");
    }

    const channels = input.channels.map((channel) => {
      if (!ALLOWED_CHANNELS.includes(channel as Channel)) {
        throw new DomainError(`invalid channel: ${channel}`);
      }

      return channel as Channel;
    });

    const now = new Date().toISOString();

    return new Notification({
      id: randomUUID(),
      eventType: input.eventType,
      recipient: input.recipient,
      channels,
      payload: input.payload ?? {},
      status: NotificationStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    });
  }

  markProcessing(): Notification {
    return this.withStatus(NotificationStatus.PROCESSING);
  }

  markDelivered(): Notification {
    return this.withStatus(NotificationStatus.DELIVERED);
  }

  markFailed(): Notification {
    return this.withStatus(NotificationStatus.FAILED);
  }

  markRetrying(): Notification {
    const current = this.toJSON();
    return new Notification({
      ...current,
      status: NotificationStatus.RETRYING,
      retryCount: current.retryCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  cancel(): Notification {
    return this.withStatus(NotificationStatus.CANCELED);
  }

  toJSON(): NotificationProps {
    return { ...this.props };
  }

  private withStatus(status: NotificationStatus): Notification {
    return new Notification({
      ...this.props,
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}
