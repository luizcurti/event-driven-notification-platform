import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { FindAllOptions, NotificationPage, NotificationRepository } from "../../application/ports";
import { ChannelState, NotificationProps } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums";
import { documentClient } from "../aws/clients";
import { environment } from "../aws/environment";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

export class DynamoNotificationRepository implements NotificationRepository {
  async save(notification: NotificationProps): Promise<void> {
    await documentClient.send(
      new PutCommand({
        TableName: environment.notificationsTableName,
        Item: notification,
      }),
    );
  }

  async updateChannelState(id: string, channel: Channel, state: ChannelState): Promise<void> {
    await documentClient.send(
      new UpdateCommand({
        TableName: environment.notificationsTableName,
        Key: { id },
        UpdateExpression: "SET channelStates.#channel = :state, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#channel": channel },
        ExpressionAttributeValues: {
          ":state": state,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );
  }

  async markCanceled(id: string, canceledAt: string): Promise<void> {
    await documentClient.send(
      new UpdateCommand({
        TableName: environment.notificationsTableName,
        Key: { id },
        UpdateExpression: "SET canceledAt = :canceledAt, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":canceledAt": canceledAt,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );
  }

  async findById(id: string): Promise<NotificationProps | null> {
    const result = await documentClient.send(
      new GetCommand({
        TableName: environment.notificationsTableName,
        Key: { id },
        ConsistentRead: true,
      }),
    );

    return (result.Item as NotificationProps | undefined) ?? null;
  }

  async findAll(options: FindAllOptions = {}): Promise<NotificationPage> {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);

    const result = await documentClient.send(
      new ScanCommand({
        TableName: environment.notificationsTableName,
        ConsistentRead: true,
        Limit: limit,
        ExclusiveStartKey: decodeCursor(options.cursor),
      }),
    );

    return {
      items: (result.Items as NotificationProps[] | undefined) ?? [],
      nextCursor: encodeCursor(result.LastEvaluatedKey),
    };
  }
}

function decodeCursor(cursor?: string): Record<string, unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
}

function encodeCursor(key?: Record<string, unknown>): string | undefined {
  if (!key) {
    return undefined;
  }

  return Buffer.from(JSON.stringify(key), "utf8").toString("base64");
}
