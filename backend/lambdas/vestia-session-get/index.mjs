import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event) => {
  try {
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "sessionId required" })
      };
    }

    const result = await client.send(
      new QueryCommand({
        TableName: "VestiaSessions",
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `SESSION#${sessionId}`
        }
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId,
        items: result.Items
      })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};