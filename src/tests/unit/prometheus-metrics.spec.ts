import { Channel } from "../../domain/enums";

const mockPushAdd = jest.fn();

jest.mock("prom-client", () => {
  const actual = jest.requireActual("prom-client");
  return {
    ...actual,
    Pushgateway: jest.fn().mockImplementation(() => ({
      pushAdd: mockPushAdd,
    })),
  };
});

describe("PrometheusMetrics", () => {
  const originalUrl = process.env.PUSHGATEWAY_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.PUSHGATEWAY_URL;
    } else {
      process.env.PUSHGATEWAY_URL = originalUrl;
    }
    jest.clearAllMocks();
  });

  it("records every metric and no-ops flush without a pushgateway url", async () => {
    delete process.env.PUSHGATEWAY_URL;
    jest.resetModules();
    const { PrometheusMetrics } = await import("../../infrastructure/aws/prometheus-metrics");

    const metrics = new PrometheusMetrics("test-job");
    metrics.notificationCreated("OrderApproved");
    metrics.deliveryAttempt(Channel.EMAIL, "success", 0.2);
    metrics.deliveryAttempt(Channel.EMAIL, "failed", 0.2);
    metrics.retryPublished(Channel.EMAIL);
    metrics.retryExhausted(Channel.EMAIL);
    metrics.notificationCanceled();

    await expect(metrics.flush()).resolves.toBeUndefined();
    expect(mockPushAdd).not.toHaveBeenCalled();
  });

  it("pushes accumulated metrics to the gateway when a url is configured", async () => {
    process.env.PUSHGATEWAY_URL = "http://pushgateway:9091";
    jest.resetModules();
    mockPushAdd.mockResolvedValueOnce(undefined);
    const { PrometheusMetrics } = await import("../../infrastructure/aws/prometheus-metrics");

    const metrics = new PrometheusMetrics("test-job");
    await metrics.flush();

    expect(mockPushAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "test-job",
        groupings: expect.objectContaining({ instance: expect.any(String) }),
      }),
    );
  });

  it("swallows pushgateway errors so observability never breaks the business flow", async () => {
    process.env.PUSHGATEWAY_URL = "http://pushgateway:9091";
    jest.resetModules();
    mockPushAdd.mockRejectedValueOnce(new Error("network down"));
    const { PrometheusMetrics } = await import("../../infrastructure/aws/prometheus-metrics");

    const metrics = new PrometheusMetrics("test-job");
    await expect(metrics.flush()).resolves.toBeUndefined();
  });
});
