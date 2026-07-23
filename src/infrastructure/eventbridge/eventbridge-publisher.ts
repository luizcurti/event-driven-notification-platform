import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { EventPayload, EventPublisher } from "../../application/ports";
import { eventBridgeClient } from "../aws/clients";
import { environment } from "../aws/environment";

export class EventBridgePublisher implements EventPublisher {
  async publish(event: EventPayload): Promise<void> {
    await eventBridgeClient.send(
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
  }
}
