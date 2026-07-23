import { Channel, NotificationStatus } from "../../domain/enums";
import { createChannelSender } from "../../infrastructure/aws/channel-senders";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";

jest.mock("../../infrastructure/aws/clients", () => ({
  documentClient: { send: jest.fn() },
  eventBridgeClient: { send: jest.fn() },
  sqsClient: { send: jest.fn() },
}));

describe("aws adapters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("console logger writes info and error", () => {
    const infoSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const logger = new ConsoleLogger();
    logger.info("x", { a: 1 });
    logger.error("y", { b: 2 });

    expect(infoSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("channel senders succeed without forceFail", async () => {
    await expect(
      createChannelSender(Channel.EMAIL).send({ notificationId: "1", recipient: "a", payload: {} }),
    ).resolves.toBeUndefined();
    await expect(
      createChannelSender(Channel.SMS).send({ notificationId: "1", recipient: "a", payload: {} }),
    ).resolves.toBeUndefined();
    await expect(
      createChannelSender(Channel.PUSH).send({ notificationId: "1", recipient: "a", payload: {} }),
    ).resolves.toBeUndefined();
  });

  it("channel senders fail with forceFail", async () => {
    await expect(
      createChannelSender(Channel.EMAIL).send({
        notificationId: "1",
        recipient: "a",
        payload: { forceFail: true },
      }),
    ).rejects.toThrow("forced-failure-email");
  });

  it("dynamo repository save/find/findAll", async () => {
    const clients = await import("../../infrastructure/aws/clients");
    const sendMock = clients.documentClient.send as jest.Mock;
    sendMock.mockResolvedValueOnce({});
    sendMock.mockResolvedValueOnce({ Item: { id: "1", status: NotificationStatus.PENDING } });
    sendMock.mockResolvedValueOnce({ Items: [{ id: "1", status: NotificationStatus.PENDING }] });

    const { DynamoNotificationRepository } =
      await import("../../infrastructure/dynamodb/dynamo-notification-repository");

    const repository = new DynamoNotificationRepository();
    await repository.save({
      id: "1",
      eventType: "OrderApproved",
      recipient: "a",
      channels: ["EMAIL" as any],
      payload: {},
      status: NotificationStatus.PENDING,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
    });

    const found = await repository.findById("1");
    const all = await repository.findAll();

    expect(found?.id).toBe("1");
    expect(all).toHaveLength(1);
    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it("dynamo repository returns null and empty array", async () => {
    const clients = await import("../../infrastructure/aws/clients");
    const sendMock = clients.documentClient.send as jest.Mock;
    sendMock.mockResolvedValueOnce({});
    sendMock.mockResolvedValueOnce({});

    const { DynamoNotificationRepository } =
      await import("../../infrastructure/dynamodb/dynamo-notification-repository");

    const repository = new DynamoNotificationRepository();
    const found = await repository.findById("x");
    const all = await repository.findAll();

    expect(found).toBeNull();
    expect(all).toEqual([]);
  });

  it("eventbridge publisher sends event", async () => {
    const clients = await import("../../infrastructure/aws/clients");
    const sendMock = clients.eventBridgeClient.send as jest.Mock;
    sendMock.mockResolvedValue({});

    const { EventBridgePublisher } =
      await import("../../infrastructure/eventbridge/eventbridge-publisher");

    const publisher = new EventBridgePublisher();
    await publisher.publish({
      id: "1",
      type: "OrderApproved",
      source: "notification-api",
      time: "2026-01-01T00:00:00.000Z",
      data: { id: "1" },
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("sqs retry queue enqueues when url exists", async () => {
    process.env.RETRY_QUEUE_URL = "http://localhost:4566/000000000000/retry";
    jest.resetModules();

    const clients = await import("../../infrastructure/aws/clients");
    const sendMock = clients.sqsClient.send as jest.Mock;
    sendMock.mockResolvedValue({});

    const { SqsRetryQueue } = await import("../../infrastructure/aws/sqs-retry-queue");
    const queue = new SqsRetryQueue();

    await queue.enqueue({ hello: "world" });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("sqs retry queue skips when url is missing", async () => {
    process.env.RETRY_QUEUE_URL = "";
    jest.resetModules();

    const clients = await import("../../infrastructure/aws/clients");
    const sendMock = clients.sqsClient.send as jest.Mock;

    const { SqsRetryQueue } = await import("../../infrastructure/aws/sqs-retry-queue");
    const queue = new SqsRetryQueue();

    await queue.enqueue({ hello: "world" });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("clients module loads with and without local endpoint", async () => {
    delete process.env.AWS_ENDPOINT_URL;
    jest.resetModules();
    const withoutEndpoint = await import("../../infrastructure/aws/clients");
    expect(withoutEndpoint.documentClient).toBeDefined();

    process.env.AWS_ENDPOINT_URL = "http://localhost:4566";
    process.env.AWS_ACCESS_KEY_ID = "test";
    process.env.AWS_SECRET_ACCESS_KEY = "test";
    jest.resetModules();
    const withEndpoint = await import("../../infrastructure/aws/clients");
    expect(withEndpoint.documentClient).toBeDefined();
  });

  it("environment exposes defaults and custom endpoint", async () => {
    delete process.env.AWS_ENDPOINT_URL;
    jest.resetModules();
    let envModule = await import("../../infrastructure/aws/environment");
    expect(envModule.environment.awsRegion).toBeDefined();

    process.env.AWS_ENDPOINT_URL = "http://localhost:4566";
    jest.resetModules();
    envModule = await import("../../infrastructure/aws/environment");
    expect(envModule.environment.awsEndpointUrl).toBe("http://localhost:4566");
  });
});
