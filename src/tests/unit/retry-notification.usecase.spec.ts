import { RetryNotificationUseCase } from "../../application/usecases/retry-notification";
import { Channel } from "../../domain/enums/channel";

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
    const useCase = new RetryNotificationUseCase(publisher, new StubLogger(), 3);

    await useCase.execute({
      notificationId: "1",
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
      retryCount: 2,
    });

    expect(publisher.count).toBe(1);
  });

  it("does not publish above max retries", async () => {
    const publisher = new StubPublisher();
    const useCase = new RetryNotificationUseCase(publisher, new StubLogger(), 3);

    await useCase.execute({
      notificationId: "1",
      recipient: "user@email.com",
      payload: {},
      channel: Channel.EMAIL,
      retryCount: 4,
    });

    expect(publisher.count).toBe(0);
  });

  it("uses default max retries from constructor", async () => {
    const publisher = new StubPublisher();
    const useCase = new RetryNotificationUseCase(publisher, new StubLogger());

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
