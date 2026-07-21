import { CreateNotificationUseCase } from "../../application/usecases/create-notification";
import { NotificationProps } from "../../domain/entities/notification";

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

class StubPublisher {
  public published = false;

  async publish(): Promise<void> {
    this.published = true;
  }
}

class StubLogger {
  info(): void {}
  error(): void {}
}

describe("CreateNotificationUseCase", () => {
  it("creates notification and publishes event", async () => {
    const repository = new InMemoryRepository();
    const publisher = new StubPublisher();
    const useCase = new CreateNotificationUseCase(repository, publisher, new StubLogger());

    const result = await useCase.execute({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: { orderId: "123" },
    });

    expect(result.id).toBeDefined();
    expect(result.status).toBe("PENDING");
    expect(repository.items.length).toBe(1);
    expect(publisher.published).toBe(true);
  });

  it("uses empty payload when payload is undefined", async () => {
    const repository = new InMemoryRepository();
    const publisher = new StubPublisher();
    const useCase = new CreateNotificationUseCase(repository, publisher, new StubLogger());

    await useCase.execute({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: undefined as unknown as Record<string, unknown>,
    });

    expect(repository.items[0].payload).toEqual({});
  });
});
