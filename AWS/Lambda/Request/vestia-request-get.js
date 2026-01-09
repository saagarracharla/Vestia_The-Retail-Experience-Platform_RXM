import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event) => {
  try {
    const storeId =
      event.queryStringParameters?.storeId ||
      event.pathParameters?.storeId;

    if (!storeId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "storeId is required" })
      };
    }

    const result = await client.send(
      new QueryCommand({
        TableName: "VestiaSessions",
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `STORE#${storeId}`,
          ":sk": "REQUEST#"
        }
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        count: result.Items.length,
        requests: result.Items
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