import { EventBridgeEvent } from "aws-lambda";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { Channel } from "../../domain/enums/channel";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { PushSender } from "../../infrastructure/aws/channel-senders";
import { SqsRetryQueue } from "../../infrastructure/aws/sqs-retry-queue";
import { DynamoNotificationRepository } from "../../infrastructure/dynamodb/dynamo-notification-repository";
import { processConsumerEvent } from "./process-consumer-event";

const useCase = new ProcessChannelNotificationUseCase(
  new DynamoNotificationRepository(),
  new PushSender(),
  new SqsRetryQueue(),
  new ConsoleLogger(),
);

export const handler = async (event: EventBridgeEvent<string, any>): Promise<void> => {
  await processConsumerEvent(event, useCase, Channel.PUSH);
};
