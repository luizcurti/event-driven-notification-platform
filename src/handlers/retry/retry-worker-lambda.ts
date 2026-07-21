import { SQSEvent } from "aws-lambda";
import { RetryNotificationUseCase } from "../../application/usecases/retry-notification";
import { Channel } from "../../domain/enums/channel";
import { ConsoleLogger } from "../../infrastructure/aws/console-logger";
import { EventBridgePublisher } from "../../infrastructure/eventbridge/eventbridge-publisher";

const useCase = new RetryNotificationUseCase(
  new EventBridgePublisher(),
  new ConsoleLogger(),
  Number(process.env.MAX_RETRIES ?? 3),
);

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body) as {
      notificationId: string;
      recipient: string;
      payload: Record<string, unknown>;
      channel: Channel;
      retryCount: number;
    };

    await useCase.execute(body);
  }
};
