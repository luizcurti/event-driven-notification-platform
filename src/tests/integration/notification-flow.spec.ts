import { CancelNotificationUseCase } from "../../application/usecases/cancel-notification";
import { CreateNotificationUseCase } from "../../application/usecases/create-notification";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { RetryNotificationUseCase } from "../../application/usecases/retry-notification";
import { ChannelState, Notification, NotificationProps } from "../../domain/entities/notification";
import { Channel, NotificationStatus } from "../../domain/enums";

class InMemoryRepository {
  public items: NotificationProps[] = [];

  async save(notification: NotificationProps): Promise<void> {
    this.items = this.items.filter((item) => item.id !== notification.id);
    this.items.push(notification);
  }

  async updateChannelState(id: string, channel: Channel, state: ChannelState): Promise<void> {
    const item = this.items.find((current) => current.id === id);
    if (!item) {
      return;
    }
    item.channelStates = { ...item.channelStates, [channel]: state };
  }

  async markCanceled(id: string, canceledAt: string): Promise<void> {
    const item = this.items.find((current) => current.id === id);
    if (!item) {
      return;
    }
    item.canceledAt = canceledAt;
  }

  async findById(id: string): Promise<NotificationProps | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findAll(): Promise<NotificationProps[]> {
    return this.items;
  }
}

class StubPublisher {
  async publish(): Promise<void> {}
}

class StubSender {
  channel = Channel.EMAIL;
  async send(): Promise<void> {}
}

class AlwaysFailingSender {
  channel = Channel.EMAIL;
  async send(): Promise<void> {
    throw new Error("channel-unavailable");
  }
}

class AlwaysSucceedingPushSender {
  channel = Channel.PUSH;
  async send(): Promise<void> {}
}

class StubRetryQueue {
  async enqueue(): Promise<void> {}
}

interface CapturedRetryMessage {
  notificationId: string;
  recipient: string;
  payload: Record<string, unknown>;
  channel: Channel;
  retryCount: number;
}

class CapturingRetryQueue {
  public messages: CapturedRetryMessage[] = [];
  async enqueue(message: Record<string, unknown>): Promise<void> {
    this.messages.push(message as unknown as CapturedRetryMessage);
  }
}

class StubLogger {
  info(): void {}
  error(): void {}
}

describe("Notification flow integration", () => {
  it("creates and delivers a notification", async () => {
    const repository = new InMemoryRepository();
    const logger = new StubLogger();

    const createUseCase = new CreateNotificationUseCase(repository, new StubPublisher(), logger);
    const created = await createUseCase.execute({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: { orderId: "123" },
    });

    const processUseCase = new ProcessChannelNotificationUseCase(
      repository,
      new StubSender(),
      new StubRetryQueue(),
      logger,
    );

    const item = await repository.findById(created.id);
    await processUseCase.execute({
      notificationId: created.id,
      recipient: item!.recipient,
      payload: item!.payload,
      channel: Channel.EMAIL,
    });

    const delivered = await repository.findById(created.id);
    expect(new Notification(delivered!).status).toBe("DELIVERED");
  });

  it("retries a failing delivery through the retry worker and marks it failed once exhausted", async () => {
    const repository = new InMemoryRepository();
    const logger = new StubLogger();
    const retryQueue = new CapturingRetryQueue();

    const createUseCase = new CreateNotificationUseCase(repository, new StubPublisher(), logger);
    const created = await createUseCase.execute({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    });

    const processUseCase = new ProcessChannelNotificationUseCase(
      repository,
      new AlwaysFailingSender(),
      retryQueue,
      logger,
    );
    const retryUseCase = new RetryNotificationUseCase(new StubPublisher(), repository, logger);

    await processUseCase.execute({
      notificationId: created.id,
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
    });

    // Drains the retry queue exactly like SQS + the retry-worker Lambda would:
    // each failed attempt republishes through the retry worker, which lands
    // back on channel processing, until retries are exhausted.
    let iterations = 0;
    while (retryQueue.messages.length > 0 && iterations < 10) {
      iterations++;
      const message = retryQueue.messages.shift()!;
      await retryUseCase.execute(message);

      const current = await repository.findById(created.id);
      if (new Notification(current!).status === NotificationStatus.FAILED) {
        break;
      }

      await processUseCase.execute({
        notificationId: created.id,
        recipient: message.recipient,
        payload: message.payload,
        channel: message.channel,
      });
    }

    const final = await repository.findById(created.id);
    expect(new Notification(final!).status).toBe(NotificationStatus.FAILED);
    expect(final!.channelStates.EMAIL.retryCount).toBe(4);
  });

  it("cancellation never overwrites channelStates, so a concurrent delivery is never lost", async () => {
    const repository = new InMemoryRepository();
    const logger = new StubLogger();

    const createUseCase = new CreateNotificationUseCase(repository, new StubPublisher(), logger);
    const created = await createUseCase.execute({
      eventType: "DocumentProcessed",
      recipient: "user@email.com",
      channels: ["PUSH"],
      payload: {},
    });

    // The channel Lambda has already picked up the notification and marked it
    // PROCESSING, exactly like ProcessChannelNotificationUseCase does before
    // calling the sender.
    await repository.updateChannelState(created.id, Channel.PUSH, {
      status: NotificationStatus.PROCESSING,
      retryCount: 0,
    });

    const cancelUseCase = new CancelNotificationUseCase(repository, logger);
    await cancelUseCase.execute(created.id);

    // Cancellation must only touch canceledAt/updatedAt (via markCanceled) and
    // leave channelStates exactly as it found them.
    const afterCancel = await repository.findById(created.id);
    expect(afterCancel!.canceledAt).not.toBeNull();
    expect(afterCancel!.channelStates.PUSH.status).toBe(NotificationStatus.PROCESSING);

    // The in-flight delivery finishes and persists its real outcome — whenever
    // it lands, it is never clobbered by the cancellation write.
    await repository.updateChannelState(created.id, Channel.PUSH, {
      status: NotificationStatus.DELIVERED,
      retryCount: 0,
    });

    const final = await repository.findById(created.id);
    expect(final!.channelStates.PUSH.status).toBe(NotificationStatus.DELIVERED);
    expect(new Notification(final!).status).toBe(NotificationStatus.CANCELED);
  });

  it("handles a genuine partial failure — one channel fails while another delivers", async () => {
    const repository = new InMemoryRepository();
    const logger = new StubLogger();
    const retryQueue = new StubRetryQueue();

    const createUseCase = new CreateNotificationUseCase(repository, new StubPublisher(), logger);
    const created = await createUseCase.execute({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL", "PUSH"],
      payload: {},
    });

    // Mirrors production: each channel is a separate Lambda with its own
    // sender, both operating on the same notification.
    const emailProcessUseCase = new ProcessChannelNotificationUseCase(
      repository,
      new AlwaysFailingSender(),
      retryQueue,
      logger,
    );
    const pushProcessUseCase = new ProcessChannelNotificationUseCase(
      repository,
      new AlwaysSucceedingPushSender(),
      retryQueue,
      logger,
    );

    await emailProcessUseCase.execute({
      notificationId: created.id,
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
    });
    await pushProcessUseCase.execute({
      notificationId: created.id,
      recipient: "user@email.com",
      payload: {},
      channel: Channel.PUSH,
    });

    const final = await repository.findById(created.id);
    expect(final!.channelStates.EMAIL.status).toBe(NotificationStatus.RETRYING);
    expect(final!.channelStates.PUSH.status).toBe(NotificationStatus.DELIVERED);
    // RETRYING outranks DELIVERED in the aggregate status, so a partial
    // failure never gets masked as an overall success.
    expect(new Notification(final!).status).toBe(NotificationStatus.RETRYING);
  });
});
