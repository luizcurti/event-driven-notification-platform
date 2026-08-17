import { CancelNotificationUseCase } from "../../application/usecases/cancel-notification";
import {
  GetNotificationUseCase,
  ListNotificationsUseCase,
} from "../../application/usecases/query-notifications";
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

  async findById(id: string): Promise<NotificationProps | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findAll(): Promise<NotificationProps[]> {
    return this.items;
  }
}

class StubLogger {
  info(): void {}
  error(): void {}
}

describe("extra use cases", () => {
  it("list notifications returns all items", async () => {
    const repository = new InMemoryRepository();
    await repository.save(
      Notification.create({
        eventType: "OrderApproved",
        recipient: "a",
        channels: ["EMAIL"],
        payload: {},
      }).toJSON(),
    );

    const useCase = new ListNotificationsUseCase(repository);
    const all = await useCase.execute();

    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("PENDING");
  });

  it("get notification returns existing item", async () => {
    const repository = new InMemoryRepository();
    const item = Notification.create({
      eventType: "OrderApproved",
      recipient: "a",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(item);

    const useCase = new GetNotificationUseCase(repository);
    const found = await useCase.execute(item.id);

    expect(found.id).toBe(item.id);
  });

  it("get notification throws when missing", async () => {
    const useCase = new GetNotificationUseCase(new InMemoryRepository());
    await expect(useCase.execute("missing")).rejects.toThrow("not found");
  });

  it("cancel notification updates status", async () => {
    const repository = new InMemoryRepository();
    const item = Notification.create({
      eventType: "OrderApproved",
      recipient: "a",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(item);

    const useCase = new CancelNotificationUseCase(repository, new StubLogger());
    const canceled = await useCase.execute(item.id);

    expect(canceled.status).toBe("CANCELED");
  });

  it("cancel notification throws when missing", async () => {
    const useCase = new CancelNotificationUseCase(new InMemoryRepository(), new StubLogger());
    await expect(useCase.execute("missing")).rejects.toThrow("not found");
  });

  it("cancel notification throws when already canceled", async () => {
    const repository = new InMemoryRepository();
    const item = Notification.create({
      eventType: "OrderApproved",
      recipient: "a",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(item);

    const useCase = new CancelNotificationUseCase(repository, new StubLogger());
    await useCase.execute(item.id);

    await expect(useCase.execute(item.id)).rejects.toThrow("already canceled");
  });

  it("cancel notification throws when already delivered", async () => {
    const repository = new InMemoryRepository();
    const item = Notification.create({
      eventType: "OrderApproved",
      recipient: "a",
      channels: ["EMAIL"],
      payload: {},
    }).toJSON();
    await repository.save(item);
    await repository.updateChannelState(item.id, Channel.EMAIL, {
      status: NotificationStatus.DELIVERED,
      retryCount: 0,
    });

    const useCase = new CancelNotificationUseCase(repository, new StubLogger());
    await expect(useCase.execute(item.id)).rejects.toThrow("cannot be canceled");
  });
});
