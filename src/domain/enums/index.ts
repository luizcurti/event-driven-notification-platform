export enum Channel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
}

export const ALLOWED_CHANNELS = Object.values(Channel);

export enum NotificationStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
  CANCELED = "CANCELED",
}
