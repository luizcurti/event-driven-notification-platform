export enum Channel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
  WEBHOOK = "WEBHOOK",
}

export const ALLOWED_CHANNELS = Object.values(Channel);
