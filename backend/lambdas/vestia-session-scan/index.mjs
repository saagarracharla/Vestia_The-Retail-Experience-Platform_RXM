import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const { sessionId, sku, kioskId } = JSON.parse(event.body);
    
    if (!sessionId || !sku || !kioskId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "sessionId, sku, and kioskId are required" })
      };
    }

    const timestamp = new Date().toISOString();
    const scanEvent = {
      PK: `SESSION#${sessionId}`,
      SK: `SCAN#${timestamp}`,
      entityType: "SCAN",
      sessionId,
      sku,
      kioskId,
      createdAt: timestamp,
      source: "kiosk"
    };

    await docClient.send(new PutCommand({
      TableName: "VestiaSessions",
      Item: scanEvent
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Item scanned",
        item: scanEvent
      })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
