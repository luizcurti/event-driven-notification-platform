import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { RetryNotificationUseCase } from "../../application/usecases/retry-notification";
import { Channel } from "../../domain/enums";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { PrometheusMetrics } from "../../infrastructure/aws/prometheus-metrics";
import { DynamoNotificationRepository } from "../../infrastructure/dynamodb/dynamo-notification-repository";
import { EventBridgePublisher } from "../../infrastructure/eventbridge/eventbridge-publisher";

const logger = new ConsoleLogger();
const metrics = new PrometheusMetrics("retry-worker");

const useCase = new RetryNotificationUseCase(
  new EventBridgePublisher(),
  new DynamoNotificationRepository(),
  logger,
  Number(process.env.MAX_RETRIES ?? 3),
  metrics,
);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  try {
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
      } catch (error) {
        logger.error("retry-worker-batch-item-failed", {
          messageId: record.messageId,
          error: error instanceof Error ? error.message : "unknown",
        });
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
  } finally {
    await metrics.flush();
  }

  return { batchItemFailures };
};
