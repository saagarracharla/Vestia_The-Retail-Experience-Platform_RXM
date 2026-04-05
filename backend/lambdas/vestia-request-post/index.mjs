import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function res(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const { sessionId, sku, requestedSize, requestedColor } = JSON.parse(event.body || "{}");

    if (!sessionId || !sku) {
      return res(400, { error: "sessionId and sku are required" });
    }

    const sessionQuery = await docClient.send(new QueryCommand({
      TableName: "VestiaSessions",
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SESSION#${sessionId}`,
        ":sk": "SCAN#",
      },
      ScanIndexForward: false,
      Limit: 1,
    }));

    if (!sessionQuery.Items || sessionQuery.Items.length === 0) {
      return res(400, { error: "No scan events found for session" });
    }

    const latestScan = sessionQuery.Items[0];
    const kioskId = latestScan.kioskId;
    const storeId = "STORE-001";
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const timestamp = new Date().toISOString();

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
      updatedAt: timestamp,
    };

    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: "VestiaSessions",
            Item: {
              PK: `SESSION#${sessionId}`,
              SK: `REQUEST#${requestId}`,
              ...requestEvent,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
        {
          Put: {
            TableName: "VestiaSessions",
            Item: {
              PK: `STORE#${storeId}`,
              SK: `REQUEST#${requestId}`,
              ...requestEvent,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
      ],
    }));

    return res(200, { requestId, status: "QUEUED" });
  } catch (error) {
    console.error("Error creating request:", error);

    if (error.name === "TransactionCanceledException" || error.name === "ConditionalCheckFailedException") {
      return res(409, { error: "Request could not be created because the generated request ID already exists." });
    }

    return res(500, { error: "Internal server error" });
  }
};
