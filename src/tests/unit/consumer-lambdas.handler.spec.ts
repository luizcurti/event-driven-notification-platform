import { EventBridgeEvent } from "aws-lambda";
import { Channel } from "../../domain/enums/channel";
import { processConsumerEvent } from "../../handlers/consumers/process-consumer-event";

const processConsumerEventMock = jest.fn();

jest.mock("../../handlers/consumers/process-consumer-event", () => ({
  processConsumerEvent: jest.fn(),
}));

describe("consumer lambdas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (processConsumerEvent as jest.Mock).mockImplementation(processConsumerEventMock);
  });

  it("email lambda delegates to process helper", async () => {
    const { handler } = await import("../../handlers/consumers/email-lambda");
    await handler({ detail: {} } as EventBridgeEvent<string, any>);
    expect(processConsumerEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      Channel.EMAIL,
    );
  });

  it("sms lambda delegates to process helper", async () => {
    const { handler } = await import("../../handlers/consumers/sms-lambda");
    await handler({ detail: {} } as EventBridgeEvent<string, any>);
    expect(processConsumerEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      Channel.SMS,
    );
  });

  it("push lambda delegates to process helper", async () => {
    const { handler } = await import("../../handlers/consumers/push-lambda");
    await handler({ detail: {} } as EventBridgeEvent<string, any>);
    expect(processConsumerEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      Channel.PUSH,
    );
  });
});
