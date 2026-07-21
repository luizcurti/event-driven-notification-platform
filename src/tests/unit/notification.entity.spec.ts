import { Notification } from "../../domain/entities/notification";
import { NotificationStatus } from "../../domain/enums/notification-status";

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

  it("supports all status transitions", () => {
    const notification = Notification.create({
      eventType: "OrderApproved",
      recipient: "user@email.com",
      channels: ["EMAIL"],
      payload: {},
    });

    expect(notification.markProcessing().toJSON().status).toBe("PROCESSING");
    expect(notification.markFailed().toJSON().status).toBe("FAILED");
    expect(notification.markRetrying().toJSON().status).toBe("RETRYING");
    expect(notification.cancel().toJSON().status).toBe("CANCELED");
  });
});
