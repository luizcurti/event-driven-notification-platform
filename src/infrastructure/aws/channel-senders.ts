import { ChannelSender } from "../../application/ports/channel-sender";
import { Channel } from "../../domain/enums/channel";

class BaseSender implements ChannelSender {
  constructor(public readonly channel: Channel) {}

  async send(input: {
    notificationId: string;
    recipient: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (input.payload.forceFail === true) {
      throw new Error(`forced-failure-${this.channel.toLowerCase()}`);
    }
  }
}

export class EmailSender extends BaseSender {
  constructor() {
    super(Channel.EMAIL);
  }
}

export class SmsSender extends BaseSender {
  constructor() {
    super(Channel.SMS);
  }
}

export class PushSender extends BaseSender {
  constructor() {
    super(Channel.PUSH);
  }
}
