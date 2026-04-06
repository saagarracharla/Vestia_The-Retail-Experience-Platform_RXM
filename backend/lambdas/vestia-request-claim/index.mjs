import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function res(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

async function findRequestRecord(requestId) {
  const scanResponse = await docClient.send(new ScanCommand({
    TableName: "VestiaSessions",
    FilterExpression: "SK = :sk AND entityType = :entityType",
    ExpressionAttributeValues: {
      ":sk": `REQUEST#${requestId}`,
      ":entityType": "REQUEST",
    },
  }));

  const items = scanResponse.Items || [];
  return items.find(item => item.PK?.startsWith("SESSION#")) || items[0] || null;
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const { requestId } = event.pathParameters || {};
    const { employeeId } = JSON.parse(event.body || "{}");

    if (!requestId || !employeeId) {
      return res(400, { error: "requestId and employeeId are required" });
    }

    const requestRecord = await findRequestRecord(requestId);
    if (!requestRecord) {
      return res(404, { error: "Request not found" });
    }

    if (requestRecord.status !== "QUEUED") {
      return res(409, {
        error: `Only queued requests can be claimed. Current status is ${requestRecord.status}.`,
        currentStatus: requestRecord.status,
      });
    }

    const timestamp = new Date().toISOString();
    const { sessionId, storeId } = requestRecord;
    const claimEvent = {
      PK: `SESSION#${sessionId}`,
      SK: `REQUEST_EVENT#${requestId}#${timestamp}`,
      entityType: "REQUEST_EVENT",
      eventType: "REQUEST_CLAIMED",
      requestId,
      sessionId,
      storeId,
      kioskId: requestRecord.kioskId,
      sku: requestRecord.sku,
      requestedSize: requestRecord.requestedSize ?? null,
      requestedColor: requestRecord.requestedColor ?? null,
      employeeId,
      status: "CLAIMED",
      createdAt: timestamp,
    };

    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: "VestiaSessions",
            Key: {
              PK: `SESSION#${sessionId}`,
              SK: `REQUEST#${requestId}`,
            },
            ConditionExpression: "#status = :queued AND attribute_not_exists(employeeId)",
            UpdateExpression: "SET #status = :claimed, employeeId = :employeeId, claimedAt = :timestamp, updatedAt = :timestamp",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":queued": "QUEUED",
              ":claimed": "CLAIMED",
              ":employeeId": employeeId,
              ":timestamp": timestamp,
            },
          },
        },
        {
          Update: {
            TableName: "VestiaSessions",
            Key: {
              PK: `STORE#${storeId}`,
              SK: `REQUEST#${requestId}`,
            },
            ConditionExpression: "#status = :queued AND attribute_not_exists(employeeId)",
            UpdateExpression: "SET #status = :claimed, employeeId = :employeeId, claimedAt = :timestamp, updatedAt = :timestamp",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":queued": "QUEUED",
              ":claimed": "CLAIMED",
              ":employeeId": employeeId,
              ":timestamp": timestamp,
            },
          },
        },
        {
          Put: {
            TableName: "VestiaSessions",
            Item: claimEvent,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
      ],
    }));

    return res(200, {
      message: "Request claimed successfully",
      requestId,
      status: "CLAIMED",
      employeeId,
      claimedAt: timestamp,
    });
  } catch (error) {
    console.error("Error claiming request:", error);

    if (error.name === "TransactionCanceledException" || error.name === "ConditionalCheckFailedException") {
      return res(409, {
        error: "Request is no longer available to claim.",
      });
    }

    return res(500, { error: "Internal server error" });
  }
};
