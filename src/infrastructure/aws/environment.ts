export const environment = {
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  awsEndpointUrl: process.env.AWS_ENDPOINT_URL,
  notificationsTableName: process.env.NOTIFICATIONS_TABLE_NAME ?? "notifications",
  eventBusName: process.env.EVENT_BUS_NAME ?? "default",
  retryQueueUrl: process.env.RETRY_QUEUE_URL ?? "",
};
