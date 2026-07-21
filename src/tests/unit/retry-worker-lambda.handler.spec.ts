import { SQSEvent } from "aws-lambda";

const executeMock = jest.fn();

jest.mock("../../application/usecases/retry-notification", () => ({
  RetryNotificationUseCase: jest.fn().mockImplementation(() => ({
    execute: executeMock,
  })),
}));

describe("retry-worker-lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes all SQS records", async () => {
    const { handler } = await import("../../handlers/retry/retry-worker-lambda");

    const event = {
      Records: [
        {
          body: JSON.stringify({
            notificationId: "1",
            recipient: "a@email.com",
            payload: {},
            channel: "EMAIL",
            retryCount: 1,
          }),
        },
        {
          body: JSON.stringify({
            notificationId: "2",
            recipient: "b@email.com",
            payload: {},
            channel: "SMS",
            retryCount: 2,
          }),
        },
      ],
    } as unknown as SQSEvent;

    await handler(event);

    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(executeMock).toHaveBeenNthCalledWith(1, {
      notificationId: "1",
      recipient: "a@email.com",
      payload: {},
      channel: "EMAIL",
      retryCount: 1,
    });
  });
});
