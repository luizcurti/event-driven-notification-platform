import { CancelNotificationUseCase } from "../../application/usecases/cancel-notification";
import {
  GetNotificationUseCase,
  ListNotificationsUseCase,
} from "../../application/usecases/query-notifications";
import { Notification } from "../../domain/entities/notification";

class InMemoryRepository {
  public items: any[] = [];

  async save(notification: any): Promise<void> {
    this.items = this.items.filter((item) => item.id !== notification.id);
    this.items.push(notification);
  }

  async findById(id: string): Promise<any | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findAll(): Promise<any[]> {
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
});
