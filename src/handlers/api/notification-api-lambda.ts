import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { CancelNotificationUseCase } from "../../application/usecases/cancel-notification";
import { CreateNotificationUseCase } from "../../application/usecases/create-notification";
import {
  GetNotificationUseCase,
  ListNotificationsUseCase,
} from "../../application/usecases/query-notifications";
import { DomainError, NotFoundError } from "../../domain/errors";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { DynamoNotificationRepository } from "../../infrastructure/dynamodb/dynamo-notification-repository";
import { EventBridgePublisher } from "../../infrastructure/eventbridge/eventbridge-publisher";

const repository = new DynamoNotificationRepository();
const logger = new ConsoleLogger();
const publisher = new EventBridgePublisher();

const createUseCase = new CreateNotificationUseCase(repository, publisher, logger);
const listUseCase = new ListNotificationsUseCase(repository);
const getUseCase = new GetNotificationUseCase(repository);
const cancelUseCase = new CancelNotificationUseCase(repository, logger);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === "POST" && event.path === "/notifications") {
      const body = parseBody(event);
      const result = await createUseCase.execute({
        eventType: body.eventType,
        recipient: body.recipient,
        channels: body.channels,
        payload: body.payload ?? {},
      });

      return response(201, result);
    }

    if (event.httpMethod === "GET" && event.path === "/notifications") {
      const notifications = await listUseCase.execute();
      return response(200, notifications);
    }

    if (event.httpMethod === "GET" && event.pathParameters?.id) {
      const notification = await getUseCase.execute(event.pathParameters.id);
      return response(200, notification);
    }

    if (event.httpMethod === "DELETE" && event.pathParameters?.id) {
      const canceled = await cancelUseCase.execute(event.pathParameters.id);
      return response(200, canceled);
    }

    return response(404, { message: "route not found" });
  } catch (error) {
    if (error instanceof DomainError) {
      return response(400, { message: error.message });
    }

    if (error instanceof NotFoundError) {
      return response(404, { message: error.message });
    }

    logger.error("api-unhandled-error", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return response(500, { message: "internal error" });
  }
};

function parseBody(event: APIGatewayProxyEvent): Record<string, any> {
  if (!event.body) {
    throw new DomainError("body is required");
  }

  return JSON.parse(event.body);
}

function response(statusCode: number, data: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}
