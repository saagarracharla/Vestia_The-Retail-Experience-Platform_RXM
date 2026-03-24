import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const { sessionId, sku, requestedSize, requestedColor } = JSON.parse(event.body);
    
    if (!sessionId || !sku) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "sessionId and sku are required" })
      };
    }

    // Get kioskId from latest SCAN event in session
    const sessionQuery = await docClient.send(new QueryCommand({
      TableName: "VestiaSessions",
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SESSION#${sessionId}`,
        ":sk": "SCAN#"
      },
      ScanIndexForward: false,
      Limit: 1
    }));

    if (!sessionQuery.Items || sessionQuery.Items.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No scan events found for session" })
      };
    }

    const latestScan = sessionQuery.Items[0];
    const kioskId = latestScan.kioskId;
    const storeId = "STORE-001"; // Default store

    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Determine request type
    let requestType = "general";
    if (requestedSize && requestedColor) {
      requestType = "size_color_change";
    } else if (requestedSize) {
      requestType = "size_change";
    } else if (requestedColor) {
      requestType = "color_change";
    }

    const requestEvent = {
      entityType: "REQUEST",
      requestId,
      sessionId,
      storeId,
      kioskId,
      sku,
      requestType,
      requestedSize: requestedSize || null,
      requestedColor: requestedColor || null,
      status: "QUEUED",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Store in session partition
    await docClient.send(new PutCommand({
      TableName: "VestiaSessions",
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `REQUEST#${requestId}`,
        ...requestEvent
      }
    }));

    // Store in store partition for staff dashboard
    await docClient.send(new PutCommand({
      TableName: "VestiaSessions",
      Item: {
        PK: `STORE#${storeId}`,
        SK: `REQUEST#${requestId}`,
        ...requestEvent
      }
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId })
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
