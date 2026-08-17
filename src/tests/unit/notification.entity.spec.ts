import { Notification } from "../../domain/entities/notification";
import { Channel, NotificationStatus } from "../../domain/enums";

describe("Notification entity", () => {
  it("creates a valid notification", () => {
    const notification = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL", "SMS"],
      payload: { orderId: "123" },
    }).toJSON();

    expect(notification.id).toBeDefined();
    expect(notification.status).toBe(NotificationStatus.PENDING);
    expect(notification.channels).toEqual(["EMAIL", "SMS"]);
    expect(notification.channelStates).toEqual({
      EMAIL: { status: NotificationStatus.PENDING, retryCount: 0 },
      SMS: { status: NotificationStatus.PENDING, retryCount: 0 },
    });
  });

  it("throws for empty event", () => {
    expect(() =>
      Notification.create({
        eventType: "",
        recipient: "user@email.com",
        channels: ["EMAIL"],
        payload: {},
      }),
    ).toThrow("eventType is required");
  });

  it("throws for invalid channel", () => {
    expect(() =>
      Notification.create({
        eventType: "OrderApproved",
        recipient: "user@email.com",
        channels: ["FAX"],
        payload: {},
      }),
    ).toThrow("invalid channel: FAX");
  });

  it("throws for empty recipient", () => {
    expect(() =>
      Notification.create({
        eventType: "OrderApproved",
        recipient: "",
        channels: ["EMAIL"],
        payload: {},
      }),
    ).toThrow("recipient is required");
  });

  it("throws when channels are empty", () => {
    expect(() =>
      Notification.create({
        eventType: "OrderApproved",
        recipient: "user@email.com",
        channels: [],
        payload: {},
      }),
    ).toThrow("channels must have at least one value");
  });

  it("tracks per-channel status transitions independently", () => {
    const notification = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL", "PUSH"],
      payload: {},
    });

    const emailProcessing = notification.markChannelProcessing(Channel.EMAIL);
    expect(emailProcessing.channelState(Channel.EMAIL).status).toBe(NotificationStatus.PROCESSING);
    expect(emailProcessing.channelState(Channel.PUSH).status).toBe(NotificationStatus.PENDING);
    expect(emailProcessing.status).toBe(NotificationStatus.PROCESSING);

    const emailDelivered = emailProcessing.markChannelDelivered(Channel.EMAIL);
    expect(emailDelivered.channelState(Channel.EMAIL).status).toBe(NotificationStatus.DELIVERED);
    expect(emailDelivered.status).toBe(NotificationStatus.PENDING);

    const pushFailed = emailDelivered.markChannelFailed(Channel.PUSH);
    expect(pushFailed.status).toBe(NotificationStatus.FAILED);

    const pushRetrying = emailDelivered.markChannelRetrying(Channel.PUSH);
    expect(pushRetrying.channelState(Channel.PUSH)).toEqual({
      status: NotificationStatus.RETRYING,
      retryCount: 1,
    });
    expect(pushRetrying.status).toBe(NotificationStatus.RETRYING);
    expect(pushRetrying.retryCount).toBe(1);
  });

  it("reports DELIVERED only once every requested channel is delivered", () => {
    const notification = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL", "PUSH"],
      payload: {},
    });

    const onlyEmailDelivered = notification.markChannelDelivered(Channel.EMAIL);
    expect(onlyEmailDelivered.status).toBe(NotificationStatus.PENDING);

    const bothDelivered = onlyEmailDelivered.markChannelDelivered(Channel.PUSH);
    expect(bothDelivered.status).toBe(NotificationStatus.DELIVERED);
  });

  it("cancel overrides status to CANCELED regardless of channel states", () => {
    const notification = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    });

    expect(notification.cancel().toJSON().status).toBe("CANCELED");
  });

  it("channelState defaults to PENDING for an unknown channel", () => {
    const notification = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    });

    expect(notification.channelState(Channel.SMS)).toEqual({
      status: NotificationStatus.PENDING,
      retryCount: 0,
    });
  });
});
