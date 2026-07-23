import { EventBridgeEvent } from "aws-lambda";
import { ProcessChannelNotificationUseCase } from "../../application/usecases/process-channel-notification";
import { Channel } from "../../domain/enums";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { createChannelSender } from "../../infrastructure/aws/channel-senders";
import { SqsRetryQueue } from "../../infrastructure/aws/sqs-retry-queue";
import { DynamoNotificationRepository } from "../../infrastructure/dynamodb/dynamo-notification-repository";
import { processConsumerEvent } from "./process-consumer-event";

function createConsumerHandler(channel: Channel) {
  const useCase = new ProcessChannelNotificationUseCase(
    new DynamoNotificationRepository(),
    createChannelSender(channel),
    new SqsRetryQueue(),
    new ConsoleLogger(),
  );

  return async (event: EventBridgeEvent<string, any>): Promise<void> => {
    await processConsumerEvent(event, useCase, channel);
  };
}

export const emailHandler = createConsumerHandler(Channel.EMAIL);
export const smsHandler = createConsumerHandler(Channel.SMS);
export const pushHandler = createConsumerHandler(Channel.PUSH);
