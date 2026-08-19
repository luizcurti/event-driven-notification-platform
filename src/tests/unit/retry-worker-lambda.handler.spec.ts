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
          messageId: "msg-1",
          body: JSON.stringify({
            notificationId: "1",
            recipient: "a@email.com",
            payload: {},
            channel: "EMAIL",
            retryCount: 1,
          }),
        },
        {
          messageId: "msg-2",
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

    const result = await handler(event);

    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(executeMock).toHaveBeenNthCalledWith(1, {
      notificationId: "1",
      recipient: "a@email.com",
      payload: {},
      channel: "EMAIL",
      retryCount: 1,
    });
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it("reports only the failing records as batch item failures", async () => {
    executeMock.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    executeMock.mockImplementationOnce(async () => undefined);

    const { handler } = await import("../../handlers/retry/retry-worker-lambda");

    const event = {
      Records: [
        {
          messageId: "msg-fail",
          body: JSON.stringify({
            notificationId: "1",
            recipient: "a@email.com",
            payload: {},
            channel: "EMAIL",
            retryCount: 1,
          }),
        },
        {
          messageId: "msg-ok",
          body: JSON.stringify({
            notificationId: "2",
            recipient: "b@email.com",
            payload: {},
            channel: "SMS",
            retryCount: 1,
          }),
        },
      ],
    } as unknown as SQSEvent;

    const result = await handler(event);

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: "msg-fail" }] });
  });

  it("logs the reason before reporting a malformed message as a batch item failure", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const { handler } = await import("../../handlers/retry/retry-worker-lambda");

    const event = {
      Records: [
        {
          messageId: "msg-malformed",
          body: "{not-valid-json",
        },
      ],
    } as unknown as SQSEvent;

    const result = await handler(event);

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: "msg-malformed" }] });
    expect(executeMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("retry-worker-batch-item-failed"),
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("msg-malformed"));

    errorSpy.mockRestore();
  });

  it("logs 'unknown' when a non-Error value is thrown", async () => {
    executeMock.mockImplementationOnce(async () => {
      throw "non-error-throw";
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const { handler } = await import("../../handlers/retry/retry-worker-lambda");

    const event = {
      Records: [
        {
          messageId: "msg-non-error",
          body: JSON.stringify({
            notificationId: "1",
            recipient: "a@email.com",
            payload: {},
            channel: "EMAIL",
            retryCount: 1,
          }),
        },
      ],
    } as unknown as SQSEvent;

    await handler(event);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("unknown"));

    errorSpy.mockRestore();
  });
});
