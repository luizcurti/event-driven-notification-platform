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
      // Demo hook: there is no real Email/SMS/Push provider here, so callers can opt a
      // notification into the retry/DLQ path deliberately via `payload.forceFail` — see README.
      if (input.payload.forceFail === true) {
        throw new Error(`forced-failure-${channel.toLowerCase()}`);
      }
    },
  };
}
