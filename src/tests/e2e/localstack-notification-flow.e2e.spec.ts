import {
  CreateEventBusCommand,
  DeleteEventBusCommand,
  DeleteRuleCommand,
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueUrlCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { APIGatewayProxyEvent } from "aws-lambda";

const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";
const region = "us-east-1";
const accountId = "000000000000";
const busName = "notifications-e2e-bus";
const tableName = "notifications-e2e";
const queueName = "notifications-e2e-events";
const ruleName = "notifications-e2e-rule";

const clientConfig = {
  region,
  endpoint,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
};

const dynamo = new DynamoDBClient(clientConfig);
const eventBridge = new EventBridgeClient(clientConfig);
const sqs = new SQSClient(clientConfig);

let queueUrl = "";
let queueArn = "";
let tableCreated = false;
let busCreated = false;
let ruleCreated = false;
let queueCreated = false;
let createdNotificationId = "";

jest.setTimeout(60000);

describe("localstack e2e notification flow", () => {
  beforeAll(async () => {
    process.env.AWS_REGION = region;
    process.env.AWS_ACCESS_KEY_ID = "test";
    process.env.AWS_SECRET_ACCESS_KEY = "test";
    process.env.AWS_ENDPOINT_URL = endpoint;
    process.env.NOTIFICATIONS_TABLE_NAME = tableName;
    process.env.EVENT_BUS_NAME = busName;
    process.env.RETRY_QUEUE_URL = "";

    // Best-effort cleanup to keep test idempotent across reruns.
    try {
      const existingQueue = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
      if (existingQueue.QueueUrl) {
        await sqs.send(new DeleteQueueCommand({ QueueUrl: existingQueue.QueueUrl }));
      }
    } catch {
      // Queue may not exist.
    }

    try {
      await eventBridge.send(
        new RemoveTargetsCommand({
          Rule: ruleName,
          EventBusName: busName,
          Ids: ["events-to-sqs"],
        }),
      );
    } catch {
      // Rule or bus may not exist.
    }

    try {
      await eventBridge.send(new DeleteRuleCommand({ Name: ruleName, EventBusName: busName }));
    } catch {
      // Rule may not exist.
    }

    try {
      await eventBridge.send(new DeleteEventBusCommand({ Name: busName }));
    } catch {
      // Bus may not exist.
    }

    try {
      await dynamo.send(new DeleteTableCommand({ TableName: tableName }));
    } catch {
      // Table may not exist.
    }

    await dynamo.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: "PAY_PER_REQUEST",
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      }),
    );
    await waitUntilTableExists(
      { client: dynamo, minDelay: 1, maxDelay: 2, maxWaitTime: 30 },
      { TableName: tableName },
    );
    tableCreated = true;

    await eventBridge.send(new CreateEventBusCommand({ Name: busName }));
    busCreated = true;

    const queue = await sqs.send(new CreateQueueCommand({ QueueName: queueName }));
    queueUrl = queue.QueueUrl as string;
    queueCreated = true;

    const attrs = await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["QueueArn"],
      }),
    );
    queueArn = attrs.Attributes?.QueueArn as string;

    const queuePolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowEventBridge",
          Effect: "Allow",
          Principal: { Service: "events.amazonaws.com" },
          Action: "sqs:SendMessage",
          Resource: queueArn,
          Condition: {
            ArnEquals: {
              "aws:SourceArn": `arn:aws:events:${region}:${accountId}:rule/${busName}/${ruleName}`,
            },
          },
        },
      ],
    };

    await sqs.send(
      new SetQueueAttributesCommand({
        QueueUrl: queueUrl,
        Attributes: {
          Policy: JSON.stringify(queuePolicy),
        },
      }),
    );

    await eventBridge.send(
      new PutRuleCommand({
        Name: ruleName,
        EventBusName: busName,
        EventPattern: JSON.stringify({
          source: ["notification-api"],
          "detail-type": ["OrderApproved"],
        }),
      }),
    );
    ruleCreated = true;

    await eventBridge.send(
      new PutTargetsCommand({
        Rule: ruleName,
        EventBusName: busName,
        Targets: [{ Id: "events-to-sqs", Arn: queueArn }],
      }),
    );
  });

  afterAll(async () => {
    if (ruleCreated && busCreated) {
      await eventBridge.send(
        new RemoveTargetsCommand({
          Rule: ruleName,
          EventBusName: busName,
          Ids: ["events-to-sqs"],
        }),
      );
      await eventBridge.send(
        new DeleteRuleCommand({
          Name: ruleName,
          EventBusName: busName,
        }),
      );
    }

    if (busCreated) {
      await eventBridge.send(new DeleteEventBusCommand({ Name: busName }));
    }

    if (queueCreated && queueUrl) {
      await sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
    }

    if (tableCreated) {
      await dynamo.send(new DeleteTableCommand({ TableName: tableName }));
    }
  });

  it("creates notification and emits event to SQS target", async () => {
    jest.resetModules();
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "POST",
      path: "/notifications",
      body: JSON.stringify({
        eventType: "OrderApproved",
        recipient: "user@email.com",
        channels: ["EMAIL"],
        payload: { orderId: "12345" },
      }),
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(201);
    const created = JSON.parse(response.body) as { id: string };
    expect(created.id).toBeDefined();
    createdNotificationId = created.id;

    let messageBody = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const received = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 1,
        }),
      );

      if (received.Messages && received.Messages.length > 0) {
        messageBody = received.Messages[0].Body as string;
        break;
      }
    }

    expect(messageBody).toContain("OrderApproved");
    expect(messageBody).toContain(created.id);
  });

  it("lists notifications", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "GET",
      path: "/notifications",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(200);
    const list = JSON.parse(response.body) as Array<{ id: string }>;
    expect(list.some((item) => item.id === createdNotificationId)).toBe(true);
  });

  it("gets notification by id", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "GET",
      path: `/notifications/${createdNotificationId}`,
      body: null,
      pathParameters: { id: createdNotificationId },
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body) as { id: string };
    expect(data.id).toBe(createdNotificationId);
  });

  it("cancels notification by id", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "DELETE",
      path: `/notifications/${createdNotificationId}`,
      body: null,
      pathParameters: { id: createdNotificationId },
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body) as { status: string };
    expect(data.status).toBe("CANCELED");
  });

  it("creates notification when payload is omitted", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "POST",
      path: "/notifications",
      body: JSON.stringify({
        eventType: "OrderApproved",
        recipient: "user@email.com",
        channels: ["EMAIL"],
      }),
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(201);
  });

  it("returns 404 for route not found", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "PUT",
      path: "/unknown-route",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ message: "route not found" });
  });

  it("returns 400 when POST body is missing", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "POST",
      path: "/notifications",
      body: null,
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ message: "body is required" });
  });

  it("returns 404 for unknown notification id", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "GET",
      path: "/notifications/00000000-0000-0000-0000-000000000001",
      body: null,
      pathParameters: { id: "00000000-0000-0000-0000-000000000001" },
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(404);
  });

  it("returns 500 for invalid JSON body", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const response = await handler({
      httpMethod: "POST",
      path: "/notifications",
      body: "{",
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ message: "internal error" });
  });

  it("returns 500 and logs unknown when a non-Error is thrown", async () => {
    const { handler } = await import("../../handlers/api/notification-api-lambda");

    const originalJsonParse = JSON.parse;
    JSON.parse = (() => {
      throw "non-error-throw";
    }) as typeof JSON.parse;

    try {
      const response = await handler({
        httpMethod: "POST",
        path: "/notifications",
        body: "{}",
        pathParameters: null,
      } as unknown as APIGatewayProxyEvent);

      expect(response.statusCode).toBe(500);
      expect(originalJsonParse(response.body)).toEqual({ message: "internal error" });
    } finally {
      JSON.parse = originalJsonParse;
    }
  });
});
