import { EventBridgeEvent } from "aws-lambda";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { Channel } from "../../domain/enums";
import { processConsumerEvent } from "../../handlers/consumers/process-consumer-event";

describe("processConsumerEvent", () => {
  it("does nothing when channel is not requested", async () => {
    const execute = jest.fn();
    const useCase = { execute } as unknown as ProcessChannelNotificationUseCase;

    const event = {
      detail: {
        id: "1",
        recipient: "user@email.com",
        channels: [Channel.EMAIL],
        payload: {},
      },
    } as EventBridgeEvent<string, any>;

    await processConsumerEvent(event, useCase, Channel.SMS);

    expect(execute).not.toHaveBeenCalled();
  });

  it("executes use case when channel is requested", async () => {
    const execute = jest.fn();
    const useCase = { execute } as unknown as ProcessChannelNotificationUseCase;

    const event = {
      detail: {
        id: "1",
        recipient: "user@email.com",
        channels: [Channel.SMS],
        payload: { p: 1 },
      },
    } as EventBridgeEvent<string, any>;

    await processConsumerEvent(event, useCase, Channel.SMS);

    expect(execute).toHaveBeenCalledWith({
      notificationId: "1",
      recipient: "user@email.com",
      payload: { p: 1 },
      channel: Channel.SMS,
    });
  });
});
