import { EventBridgeEvent } from "aws-lambda";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { Channel } from "../../domain/enums";

interface NotificationRequestedDetail {
  id: string;
  recipient: string;
  channels: Channel[];
  payload: Record<string, unknown>;
}

export async function processConsumerEvent(
  event: EventBridgeEvent<string, NotificationRequestedDetail>,
  useCase: ProcessChannelNotificationUseCase,
  channel: Channel,
): Promise<void> {
  const detail = event.detail;
  if (!detail.channels.includes(channel)) {
    return;
  }

  await useCase.execute({
    notificationId: detail.id,
    recipient: detail.recipient,
    payload: detail.payload,
    channel,
  });
}
