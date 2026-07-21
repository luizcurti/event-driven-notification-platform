import { APIGatewayProxyEvent } from "aws-lambda";
import { DomainError } from "../../domain/errors/domain-error";
import { NotFoundError } from "../../domain/errors/not-found-error";

const createExecute = jest.fn();
const listExecute = jest.fn();
const getExecute = jest.fn();
const cancelExecute = jest.fn();
const loggerError = jest.fn();

jest.mock("../../application/usecases/create-notification", () => ({
  CreateNotificationUseCase: jest.fn().mockImplementation(() => ({ execute: createExecute })),
}));

jest.mock("../../application/usecases/list-notifications", () => ({
  ListNotificationsUseCase: jest.fn().mockImplementation(() => ({ execute: listExecute })),
}));

jest.mock("../../application/usecases/get-notification", () => ({
  GetNotificationUseCase: jest.fn().mockImplementation(() => ({ execute: getExecute })),
}));

jest.mock("../../application/usecases/cancel-notification", () => ({
  CancelNotificationUseCase: jest.fn().mockImplementation(() => ({ execute: cancelExecute })),
}));

jest.mock("../../infrastructure/aws/console-logger", () => ({
  ConsoleLogger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: loggerError,
  })),
}));

describe("notification-api-lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 201 for POST notifications", async () => {
    createExecute.mockResolvedValue({ id: "1", status: "PENDING" });
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "POST",
      path: "/notifications",
      body: JSON.stringify({
        eventType: "OrderApproved",
        recipient: "user@email.com",
        channels: ["EMAIL"],
        payload: { orderId: "1" },
      }),
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({ id: "1", status: "PENDING" });
  });

  it("returns 200 for list notifications", async () => {
    listExecute.mockResolvedValue([{ id: "1", status: "DELIVERED" }]);
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "GET",
      path: "/notifications",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([{ id: "1", status: "DELIVERED" }]);
  });

  it("returns 200 for get notification by id", async () => {
    getExecute.mockResolvedValue({ id: "1", status: "DELIVERED" });
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "GET",
      path: "/notifications/1",
      body: null,
      pathParameters: { id: "1" },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ id: "1", status: "DELIVERED" });
  });

  it("returns 200 for cancel notification", async () => {
    cancelExecute.mockResolvedValue({ id: "1", status: "CANCELED" });
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "DELETE",
      path: "/notifications/1",
      body: null,
      pathParameters: { id: "1" },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ id: "1", status: "CANCELED" });
  });

  it("returns 404 for unknown route", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "PATCH",
      path: "/invalid",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
  });

  it("returns 400 when body is missing on POST", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "POST",
      path: "/notifications",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: "body is required" });
  });

  it("returns 400 for domain errors", async () => {
    createExecute.mockRejectedValue(new DomainError("invalid"));
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "POST",
      path: "/notifications",
      body: JSON.stringify({ eventType: "x", recipient: "y", channels: ["EMAIL"], payload: {} }),
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: "invalid" });
  });

  it("uses empty payload when payload is missing", async () => {
    createExecute.mockResolvedValue({ id: "1", status: "PENDING" });
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "POST",
      path: "/notifications",
      body: JSON.stringify({
        eventType: "OrderApproved",
        recipient: "user@email.com",
        channels: ["EMAIL"],
      }),
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);
    expect(result.statusCode).toBe(201);
    expect(createExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {},
      }),
    );
  });

  it("returns 404 for not found errors", async () => {
    getExecute.mockRejectedValue(new NotFoundError("not found"));
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "GET",
      path: "/notifications/2",
      body: null,
      pathParameters: { id: "2" },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: "not found" });
  });

  it("returns 500 for unexpected errors", async () => {
    listExecute.mockRejectedValue(new Error("boom"));
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "GET",
      path: "/notifications",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(loggerError).toHaveBeenCalled();
  });

  it("returns 500 and unknown message for non Error throw", async () => {
    listExecute.mockRejectedValue("boom");
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const event = {
      httpMethod: "GET",
      path: "/notifications",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(loggerError).toHaveBeenCalledWith(
      "api-unhandled-error",
      expect.objectContaining({ error: "unknown" }),
    );
  });
});
