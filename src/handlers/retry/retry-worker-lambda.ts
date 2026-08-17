import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { RetryNotificationUseCase } from "../../application/usecases/retry-notification";
import { Channel } from "../../domain/enums";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { DynamoNotificationRepository } from "../../infrastructure/dynamodb/dynamo-notification-repository";
import { EventBridgePublisher } from "../../infrastructure/eventbridge/eventbridge-publisher";

const useCase = new RetryNotificationUseCase(
  new EventBridgePublisher(),
  new DynamoNotificationRepository(),
  new ConsoleLogger(),
  Number(process.env.MAX_RETRIES ?? 3),
);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as {
        notificationId: string;
        recipient: string;
        payload: Record<string, unknown>;
        channel: Channel;
        retryCount: number;
      };

      await useCase.execute(body);
    } catch {
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
