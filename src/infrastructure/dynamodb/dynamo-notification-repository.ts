import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { NotificationRepository } from "../../application/ports";
import { NotificationProps } from "../../domain/entities/notification";
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

  async findById(id: string): Promise<NotificationProps | null> {
    const result = await documentClient.send(
      new GetCommand({
        TableName: environment.notificationsTableName,
        Key: { id },
      }),
    );

    return (result.Item as NotificationProps | undefined) ?? null;
  }

  async findAll(): Promise<NotificationProps[]> {
    const result = await documentClient.send(
      new ScanCommand({
        TableName: environment.notificationsTableName,
      }),
    );

    return (result.Items as NotificationProps[] | undefined) ?? [];
  }
}
