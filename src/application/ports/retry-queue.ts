export interface RetryQueue {
  enqueue(message: Record<string, unknown>): Promise<void>;
}
