import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { environment } from "./environment";

const baseClientConfig = environment.awsEndpointUrl
  ? {
      region: environment.awsRegion,
      endpoint: environment.awsEndpointUrl,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
      },
    }
  : { region: environment.awsRegion };

const dynamoClient = new DynamoDBClient(baseClientConfig);
const eventBridgeClient = new EventBridgeClient(baseClientConfig);
const sqsClient = new SQSClient(baseClientConfig);

export const documentClient = DynamoDBDocumentClient.from(dynamoClient);
export { eventBridgeClient, sqsClient };
