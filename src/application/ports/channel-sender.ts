import { Channel } from "../../domain/enums/channel";

export interface ChannelSender {
  channel: Channel;
  send(input: {
    notificationId: string;
    recipient: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}
