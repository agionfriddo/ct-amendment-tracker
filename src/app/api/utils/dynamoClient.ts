import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

export const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: defaultProvider(),
});
