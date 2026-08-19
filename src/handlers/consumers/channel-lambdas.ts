import { EventBridgeEvent } from "aws-lambda";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { Channel } from "../../domain/enums";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { createChannelSender } from "../../infrastructure/aws/channel-senders";
import { PrometheusMetrics } from "../../infrastructure/aws/prometheus-metrics";
import { SqsRetryQueue } from "../../infrastructure/aws/sqs-retry-queue";
import { DynamoNotificationRepository } from "../../infrastructure/dynamodb/dynamo-notification-repository";
import { processConsumerEvent } from "./process-consumer-event";

function createConsumerHandler(channel: Channel) {
  const metrics = new PrometheusMetrics(`channel-${channel.toLowerCase()}`);
  const useCase = new ProcessChannelNotificationUseCase(
    new DynamoNotificationRepository(),
    createChannelSender(channel),
    new SqsRetryQueue(),
    new ConsoleLogger(),
    metrics,
  );

  return async (event: EventBridgeEvent<string, any>): Promise<void> => {
    try {
      await processConsumerEvent(event, useCase, channel);
    } finally {
      await metrics.flush();
    }
  };
}

export const emailHandler = createConsumerHandler(Channel.EMAIL);
export const smsHandler = createConsumerHandler(Channel.SMS);
export const pushHandler = createConsumerHandler(Channel.PUSH);
