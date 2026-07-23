import { CreateNotificationUseCase } from "../../application/usecases/create-notification";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { NotificationProps } from "../../domain/entities/notification";
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

class StubPublisher {
  async publish(): Promise<void> {}
}

class StubSender {
  channel = Channel.EMAIL;
  async send(): Promise<void> {}
}

class StubRetryQueue {
  async enqueue(): Promise<void> {}
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
    expect(delivered?.status).toBe("DELIVERED");
  });
});
