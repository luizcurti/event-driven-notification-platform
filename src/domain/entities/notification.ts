import { randomUUID } from "node:crypto";
import { ALLOWED_CHANNELS, Channel, NotificationStatus } from "../enums";
import { DomainError } from "../errors";

export interface ChannelState {
  status: NotificationStatus;
  retryCount: number;
}

export interface NotificationProps {
  id: string;
  eventType: string;
  recipient: string;
  channels: Channel[];
  payload: Record<string, unknown>;
  channelStates: Record<string, ChannelState>;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {
  eventType: string;
  recipient: string;
  channels: string[];
  payload: Record<string, unknown>;
}

const PENDING_CHANNEL_STATE: ChannelState = { status: NotificationStatus.PENDING, retryCount: 0 };

export class Notification {
  constructor(private readonly props: NotificationProps) {}

  static create(input: CreateNotificationInput): Notification {
    if (typeof input.eventType !== "string" || input.eventType.trim().length === 0) {
      throw new DomainError("eventType is required");
    }

    if (typeof input.recipient !== "string" || input.recipient.trim().length === 0) {
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
    const channelStates: Record<string, ChannelState> = {};
    for (const channel of channels) {
      channelStates[channel] = { ...PENDING_CHANNEL_STATE };
    }

    return new Notification({
      id: randomUUID(),
      eventType: input.eventType,
      recipient: input.recipient,
      channels,
      payload: input.payload ?? {},
      channelStates,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Aggregate status derived from every requested channel's individual state. */
  get status(): NotificationStatus {
    if (this.props.canceledAt) {
      return NotificationStatus.CANCELED;
    }

    const states = Object.values(this.props.channelStates);
    if (states.some((state) => state.status === NotificationStatus.RETRYING)) {
      return NotificationStatus.RETRYING;
    }
    if (states.some((state) => state.status === NotificationStatus.PROCESSING)) {
      return NotificationStatus.PROCESSING;
    }
    if (states.some((state) => state.status === NotificationStatus.FAILED)) {
      return NotificationStatus.FAILED;
    }
    if (
      states.length > 0 &&
      states.every((state) => state.status === NotificationStatus.DELIVERED)
    ) {
      return NotificationStatus.DELIVERED;
    }

    return NotificationStatus.PENDING;
  }

  /** Worst-case retry attempts across every channel, for a quick summary in API responses. */
  get retryCount(): number {
    return Object.values(this.props.channelStates).reduce(
      (max, state) => Math.max(max, state.retryCount),
      0,
    );
  }

  channelState(channel: Channel): ChannelState {
    return this.props.channelStates[channel] ?? { ...PENDING_CHANNEL_STATE };
  }

  markChannelProcessing(channel: Channel): Notification {
    return this.withChannelStatus(channel, NotificationStatus.PROCESSING);
  }

  markChannelDelivered(channel: Channel): Notification {
    return this.withChannelStatus(channel, NotificationStatus.DELIVERED);
  }

  markChannelFailed(channel: Channel): Notification {
    return this.withChannelStatus(channel, NotificationStatus.FAILED);
  }

  markChannelRetrying(channel: Channel): Notification {
    const current = this.channelState(channel);
    return this.withChannelState(channel, {
      status: NotificationStatus.RETRYING,
      retryCount: current.retryCount + 1,
    });
  }

  cancel(): Notification {
    return new Notification({
      ...this.props,
      canceledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  toJSON(): NotificationProps & { status: NotificationStatus; retryCount: number } {
    return { ...this.props, status: this.status, retryCount: this.retryCount };
  }

  private withChannelStatus(channel: Channel, status: NotificationStatus): Notification {
    const current = this.channelState(channel);
    return this.withChannelState(channel, { ...current, status });
  }

  private withChannelState(channel: Channel, state: ChannelState): Notification {
    return new Notification({
      ...this.props,
      channelStates: { ...this.props.channelStates, [channel]: state },
      updatedAt: new Date().toISOString(),
    });
  }
}
