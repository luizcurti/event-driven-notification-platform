import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { RetryQueue } from "../../application/ports/retry-queue";
import { environment } from "./environment";
import { sqsClient } from "./clients";

export class SqsRetryQueue implements RetryQueue {
  async enqueue(message: Record<string, unknown>): Promise<void> {
    if (!environment.retryQueueUrl) {
      return;
    }

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: environment.retryQueueUrl,
        MessageBody: JSON.stringify(message),
      }),
    );
  }
}
