export interface EventPayload {
  id: string;
  type: string;
  source: string;
  time: string;
  data: unknown;
}

export interface EventPublisher {
  publish(event: EventPayload): Promise<void>;
}
