import { randomUUID } from "crypto";
import { Counter, Histogram, Pushgateway, Registry } from "prom-client";
import { Metrics } from "../../application/ports";
import { Channel } from "../../domain/enums";

const registry = new Registry();

const notificationsCreatedTotal = new Counter({
  name: "notifications_created_total",
  help: "Total number of notifications created",
  labelNames: ["event_type"] as const,
  registers: [registry],
});

const deliveryAttemptsTotal = new Counter({
  name: "notification_delivery_attempts_total",
  help: "Total number of channel delivery attempts",
  labelNames: ["channel", "status"] as const,
  registers: [registry],
});

const deliveryDurationSeconds = new Histogram({
  name: "notification_delivery_duration_seconds",
  help: "Duration of channel delivery attempts, in seconds",
  labelNames: ["channel", "status"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

const retriesPublishedTotal = new Counter({
  name: "notification_retries_published_total",
  help: "Total number of retry attempts republished to the event bus",
  labelNames: ["channel"] as const,
  registers: [registry],
});

const retriesExhaustedTotal = new Counter({
  name: "notification_retries_exhausted_total",
  help: "Total number of channel deliveries that exhausted their retry budget",
  labelNames: ["channel"] as const,
  registers: [registry],
});

const notificationsCanceledTotal = new Counter({
  name: "notifications_canceled_total",
  help: "Total number of notifications canceled",
  registers: [registry],
});

// AWS_LAMBDA_LOG_STREAM_NAME contains "/", "[" and "]" (e.g. "2024/01/15/[$LATEST]abcdef..."),
// which break the Pushgateway grouping-key URL path if used unsanitized.
const instanceId = (process.env.AWS_LAMBDA_LOG_STREAM_NAME ?? randomUUID()).replace(
  /[^a-zA-Z0-9_.-]/g,
  "_",
);

export class PrometheusMetrics implements Metrics {
  private readonly gateway?: Pushgateway<"text/plain; version=0.0.4; charset=utf-8">;

  constructor(private readonly job: string) {
    const url = process.env.PUSHGATEWAY_URL;
    if (url) {
      this.gateway = new Pushgateway(url, {}, registry);
    }
  }

  notificationCreated(eventType: string): void {
    notificationsCreatedTotal.inc({ event_type: eventType });
  }

  deliveryAttempt(channel: Channel, status: "success" | "failed", durationSeconds: number): void {
    deliveryAttemptsTotal.inc({ channel, status });
    deliveryDurationSeconds.observe({ channel, status }, durationSeconds);
  }

  retryPublished(channel: Channel): void {
    retriesPublishedTotal.inc({ channel });
  }

  retryExhausted(channel: Channel): void {
    retriesExhaustedTotal.inc({ channel });
  }

  notificationCanceled(): void {
    notificationsCanceledTotal.inc();
  }

  async flush(): Promise<void> {
    if (!this.gateway) {
      return;
    }

    try {
      await this.gateway.pushAdd({ jobName: this.job, groupings: { instance: instanceId } });
    } catch {
      // Observability must never break the business flow.
    }
  }
}
