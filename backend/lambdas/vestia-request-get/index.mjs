import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event) => {
  try {
    const storeId = event.pathParameters?.storeId;
    const statusFilter = event.queryStringParameters?.status;

    if (!storeId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "storeId is required" })
      };
    }

    const params = {
      TableName: "VestiaSessions",
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `STORE#${storeId}`,
        ":sk": "REQUEST#"
      }
    };

    const result = await client.send(new QueryCommand(params));

    let requests = result.Items || [];

    // Optional status filter (QUEUED, DELIVERED, etc.)
    if (statusFilter) {
      requests = requests.filter(
        r => r.status === statusFilter
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        storeId,
        count: requests.length,
        requests
      })
    };

  } catch (err) {
    console.error("Get store requests error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};