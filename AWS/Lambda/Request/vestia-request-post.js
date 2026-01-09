import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const client = new DynamoDBClient({});

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const {
      storeId,
      sessionId,
      sku,
      requestedSize,
      requestedColor,
      category
    } = body;

    if (!storeId || !sessionId || !sku) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" })
      };
    }

    const requestId = `REQ-${crypto.randomInt(100000, 999999)}`;
    const timestamp = new Date().toISOString();

    const baseRequest = {
      requestId,
      sku,
      requestedSize,
      requestedColor,
      category,
      status: "QUEUED",
      createdAt: timestamp,
      entityType: "REQUEST"
    };

    // 1️⃣ Session record (for kiosk)
    await client.send(
      new PutCommand({
        TableName: "VestiaSessions",
        Item: {
          PK: `SESSION#${sessionId}`,
          SK: `REQUEST#${requestId}`,
          ...baseRequest
        }
      })
    );

    // 2️⃣ Store record (for staff)
    await client.send(
      new PutCommand({
        TableName: "VestiaSessions",
        Item: {
          PK: `STORE#${storeId}`,
          SK: `REQUEST#${requestId}`,
          sessionId,
          ...baseRequest
        }
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Request created",
        requestId,
        status: "QUEUED"
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