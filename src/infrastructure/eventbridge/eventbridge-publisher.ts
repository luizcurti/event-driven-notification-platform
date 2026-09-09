import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { EventPayload, EventPublisher } from "../../application/ports";
import { eventBridgeClient } from "../aws/clients";
import { environment } from "../aws/environment";

export class EventBridgePublisher implements EventPublisher {
  async publish(event: EventPayload): Promise<void> {
    const result = await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: environment.eventBusName,
            Source: event.source,
            DetailType: event.type,
            Time: new Date(event.time),
            Detail: JSON.stringify(event.data),
          },
        ],
      }),
    );

    // PutEvents can return HTTP 200 while individual entries fail (e.g. throttling),
    // so a non-zero FailedEntryCount must be treated as a publish failure explicitly.
    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      const errorCode = result.Entries?.[0]?.ErrorCode ?? "unknown";
      throw new Error(`eventbridge-publish-failed: ${errorCode}`);
    }
  }
}
