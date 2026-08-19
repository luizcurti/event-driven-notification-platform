import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NotificationRepository } from "../../application/ports";
import { ChannelState, NotificationProps } from "../../domain/entities/notification";
import { Channel } from "../../domain/enums";
import { documentClient } from "../aws/clients";
import { environment } from "../aws/environment";

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

  async findAll(): Promise<NotificationProps[]> {
    const result = await documentClient.send(
      new ScanCommand({
        TableName: environment.notificationsTableName,
        ConsistentRead: true,
      }),
    );

    return (result.Items as NotificationProps[] | undefined) ?? [];
  }
}
