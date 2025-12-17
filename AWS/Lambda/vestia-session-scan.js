import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const {
      sessionId,
      sku,
      name,
      color,
      size,
      category,
      material,
      price
    } = body;

    if (!sessionId || !sku) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "sessionId and sku are required" })
      };
    }

    const timestamp = new Date().toISOString();

    const item = {
      sessionId,
      scannedAt: timestamp, // <-- ACTUAL SORT KEY
      sku,
      name: name || `Item ${sku}`,
      color: color || "Unknown",
      size: size || "Unknown",
      category: category || "General",
      material: material || "Unknown",
      price: price || 0
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