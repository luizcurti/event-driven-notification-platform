export enum Channel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
  WEBHOOK = "WEBHOOK",
}

export const ALLOWED_CHANNELS = Object.values(Channel);

export enum NotificationStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
  EXPIRED = "EXPIRED",
  CANCELED = "CANCELED",
}
