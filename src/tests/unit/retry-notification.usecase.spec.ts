import { RetryNotificationUseCase } from "../../application/usecases/retry-notification";
import { ChannelState, Notification, NotificationProps } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums";

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
  public count = 0;
  async publish(): Promise<void> {
    this.count += 1;
  }
}

class StubLogger {
  info(): void {}
  error(): void {}
}

describe("RetryNotificationUseCase", () => {
  it("publishes retry while below max retries", async () => {
    const publisher = new StubPublisher();
    const repository = new InMemoryRepository();
    const useCase = new RetryNotificationUseCase(publisher, repository, new StubLogger(), 3);

    await useCase.execute({
      notificationId: "1",
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
      retryCount: 2,
    });

    expect(publisher.count).toBe(1);
  });

  it("marks the channel as FAILED and stops retrying once above max retries", async () => {
    const publisher = new StubPublisher();
    const repository = new InMemoryRepository();
    const created = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(created);

    const useCase = new RetryNotificationUseCase(publisher, repository, new StubLogger(), 3);

    await useCase.execute({
      notificationId: created.id,
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
      retryCount: 4,
    });

    expect(publisher.count).toBe(0);
    const updated = await repository.findById(created.id);
    expect(new Notification(updated!).status).toBe("FAILED");
  });

  it("does nothing when the notification no longer exists", async () => {
    const publisher = new StubPublisher();
    const repository = new InMemoryRepository();
    const useCase = new RetryNotificationUseCase(publisher, repository, new StubLogger(), 3);

    await useCase.execute({
      notificationId: "missing",
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
      retryCount: 4,
    });

    expect(publisher.count).toBe(0);
  });

  it("uses default max retries from constructor", async () => {
    const publisher = new StubPublisher();
    const repository = new InMemoryRepository();
    const useCase = new RetryNotificationUseCase(publisher, repository, new StubLogger());

    await useCase.execute({
      notificationId: "1",
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
      retryCount: 3,
    });

    expect(publisher.count).toBe(1);
  });
});
