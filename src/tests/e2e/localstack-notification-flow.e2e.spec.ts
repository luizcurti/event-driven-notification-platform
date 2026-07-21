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
});
