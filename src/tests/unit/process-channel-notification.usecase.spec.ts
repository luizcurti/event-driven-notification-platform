import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { Notification, NotificationProps } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums";

class InMemoryRepository {
  public items: NotificationProps[] = [];

  async save(notification: NotificationProps): Promise<void> {
    this.items = this.items.filter((item) => item.id !== notification.id);
    this.items.push(notification);
  }

  async findById(id: string): Promise<NotificationProps | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findAll(): Promise<NotificationProps[]> {
    return this.items;
  }
}

class SuccessSender {
  channel = Channel.EMAIL;
  async send(): Promise<void> {}
}

class FailureSender {
  channel = Channel.EMAIL;
  async send(): Promise<void> {
    throw new Error("send failed");
  }
}

class NonErrorFailureSender {
  channel = Channel.EMAIL;
  async send(): Promise<void> {
    throw "send failed";
  }
}

class StubRetryQueue {
  public enqueued = false;
  async enqueue(): Promise<void> {
    this.enqueued = true;
  }
}

class StubLogger {
  info(): void {}
  error(): void {}
}

describe("ProcessChannelNotificationUseCase", () => {
  it("marks as delivered when sender succeeds", async () => {
    const repository = new InMemoryRepository();
    const created = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(created);

    const useCase = new ProcessChannelNotificationUseCase(
      repository,
      new SuccessSender(),
      new StubRetryQueue(),
      new StubLogger(),
    );

    await useCase.execute({
      notificationId: created.id,
      recipient: created.recipient,
      payload: created.payload,
      channel: Channel.EMAIL,
    });

    const updated = await repository.findById(created.id);
    expect(updated?.status).toBe("DELIVERED");
  });

  it("enqueues retry when sender fails", async () => {
    const repository = new InMemoryRepository();
    const retryQueue = new StubRetryQueue();
    const created = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(created);

    const useCase = new ProcessChannelNotificationUseCase(
      repository,
      new FailureSender(),
      retryQueue,
      new StubLogger(),
    );

    await useCase.execute({
      notificationId: created.id,
      recipient: created.recipient,
      payload: created.payload,
      channel: Channel.EMAIL,
    });

    const updated = await repository.findById(created.id);
    expect(updated?.status).toBe("RETRYING");
    expect(retryQueue.enqueued).toBe(true);
  });

  it("returns without processing when notification does not exist", async () => {
    const repository = new InMemoryRepository();
    const retryQueue = new StubRetryQueue();
    const useCase = new ProcessChannelNotificationUseCase(
      repository,
      new SuccessSender(),
      retryQueue,
      new StubLogger(),
    );

    await useCase.execute({
      notificationId: "not-found",
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
    });

    expect(retryQueue.enqueued).toBe(false);
  });

  it("handles non Error throw from sender", async () => {
    const repository = new InMemoryRepository();
    const created = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(created);

    const useCase = new ProcessChannelNotificationUseCase(
      repository,
      new NonErrorFailureSender(),
      new StubRetryQueue(),
      new StubLogger(),
    );

    await useCase.execute({
      notificationId: created.id,
      recipient: created.recipient,
      payload: created.payload,
      channel: Channel.EMAIL,
    });

    const updated = await repository.findById(created.id);
    expect(updated?.status).toBe("RETRYING");
  });
});
