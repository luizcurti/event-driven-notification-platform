import { EventBridgeEvent } from "aws-lambda";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { Channel } from "../../domain/enums/channel";
import { SmsSender } from "../../infrastructure/aws/channel-senders";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { SqsRetryQueue } from "../../infrastructure/aws/sqs-retry-queue";
import { DynamoNotificationRepository } from "../../infrastructure/dynamodb/dynamo-notification-repository";
import { processConsumerEvent } from "./process-consumer-event";

const useCase = new ProcessChannelNotificationUseCase(
  new DynamoNotificationRepository(),
  new SmsSender(),
  new SqsRetryQueue(),
  new ConsoleLogger(),
);

export const handler = async (event: EventBridgeEvent<string, any>): Promise<void> => {
  await processConsumerEvent(event, useCase, Channel.SMS);
};
