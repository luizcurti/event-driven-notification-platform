import { ChannelSender } from "../../application/ports";
import { Channel } from "../../domain/enums";

export function createChannelSender(channel: Channel): ChannelSender {
  return {
    channel,
    async send(input: {
      notificationId: string;
      recipient: string;
      payload: Record<string, unknown>;
    }): Promise<void> {
      if (input.payload.forceFail === true) {
        throw new Error(`forced-failure-${channel.toLowerCase()}`);
      }
    },
  };
}
