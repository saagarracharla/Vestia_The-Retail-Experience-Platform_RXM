import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : event;

    const {
      sessionId,
      sku,
      name,
      color,
      size,
      category,
      material,
      price,
      storeId,
      kioskId
    } = body;

    if (!sessionId || !sku) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "sessionId and sku are required" })
      };
    }

    const timestamp = new Date().toISOString();

    const item = {
      PK: `SESSION#${sessionId}`,
      SK: `SCAN#${timestamp}`,

      entityType: "SCAN",

      sessionId,
      storeId,
      kioskId,

      sku,
      name,
      color,
      size,
      category,
      material,
      price,

      createdAt: timestamp
    };

    await client.send(
      new PutCommand({
        TableName: "VestiaSessions",
        Item: item
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Item scanned",
        item
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