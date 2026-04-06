import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const VALID_STATUSES = new Set(["QUEUED", "CLAIMED", "DELIVERED", "CANCELLED"]);
const ALLOWED_TRANSITIONS = {
  QUEUED: new Set(["CANCELLED"]),
  CLAIMED: new Set(["DELIVERED", "CANCELLED"]),
  DELIVERED: new Set(),
  CANCELLED: new Set(),
};

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
  const result = await docClient.send(new ScanCommand({
    TableName: "VestiaSessions",
    FilterExpression: "SK = :sk AND entityType = :entityType",
    ExpressionAttributeValues: {
      ":sk": `REQUEST#${requestId}`,
      ":entityType": "REQUEST",
    },
  }));

  const items = result.Items || [];
  return items.find(item => item.PK?.startsWith("SESSION#")) || items[0] || null;
}

function getTargetStatus(body) {
  if (body.action === "delivered") {
    return "DELIVERED";
  }

  return body.status;
}

function getRequestEventType(targetStatus) {
  if (targetStatus === "DELIVERED") return "REQUEST_DELIVERED";
  if (targetStatus === "CANCELLED") return "REQUEST_CANCELLED";
  return "REQUEST_UPDATED";
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const { requestId } = event.pathParameters || {};
    const body = JSON.parse(event.body || "{}");
    const targetStatus = getTargetStatus(body);

    if (!requestId) {
      return res(400, { error: "requestId is required" });
    }

    if (!targetStatus || !VALID_STATUSES.has(targetStatus)) {
      return res(400, { error: "A valid target status is required" });
    }

    if (targetStatus === "CLAIMED") {
      return res(400, { error: "Use PATCH /request/{id}/claim to claim a request" });
    }

    const request = await findRequestRecord(requestId);
    if (!request) {
      return res(404, { error: "Request not found" });
    }

    const currentStatus = request.status;
    if (currentStatus === targetStatus) {
      return res(200, {
        message: "Request already in requested state",
        status: currentStatus,
        autoScan: false,
        alreadyInState: true,
      });
    }

    if (!ALLOWED_TRANSITIONS[currentStatus]?.has(targetStatus)) {
      return res(409, {
        error: `Invalid transition from ${currentStatus} to ${targetStatus}`,
        currentStatus,
        targetStatus,
      });
    }

    const timestamp = new Date().toISOString();
    let updateExpression = "SET #status = :targetStatus, updatedAt = :timestamp";
    const exprNames = { "#status": "status" };
    const exprValues = {
      ":currentStatus": currentStatus,
      ":targetStatus": targetStatus,
      ":timestamp": timestamp,
    };

    if (targetStatus === "DELIVERED") {
      updateExpression += ", deliveredAt = if_not_exists(deliveredAt, :timestamp)";
    }

    if (targetStatus === "CANCELLED") {
      updateExpression += ", cancelledAt = if_not_exists(cancelledAt, :timestamp)";
    }

    const requestStateEvent = {
      PK: `SESSION#${request.sessionId}`,
      SK: `REQUEST_EVENT#${requestId}#${timestamp}`,
      entityType: "REQUEST_EVENT",
      eventType: getRequestEventType(targetStatus),
      requestId,
      sessionId: request.sessionId,
      storeId: request.storeId,
      kioskId: request.kioskId,
      sku: request.sku,
      requestedSize: request.requestedSize ?? null,
      requestedColor: request.requestedColor ?? null,
      status: targetStatus,
      createdAt: timestamp,
    };

    if (request.employeeId) {
      requestStateEvent.employeeId = request.employeeId;
    }

    const transactItems = [
      {
        Update: {
          TableName: "VestiaSessions",
          Key: {
            PK: `SESSION#${request.sessionId}`,
            SK: `REQUEST#${requestId}`,
          },
          ConditionExpression: "#status = :currentStatus",
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
        },
      },
      {
        Update: {
          TableName: "VestiaSessions",
          Key: {
            PK: `STORE#${request.storeId}`,
            SK: `REQUEST#${requestId}`,
          },
          ConditionExpression: "#status = :currentStatus",
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
        },
      },
      {
        Put: {
          TableName: "VestiaSessions",
          Item: requestStateEvent,
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        },
      },
    ];

    if (targetStatus === "DELIVERED") {
      transactItems.push({
        Put: {
          TableName: "VestiaSessions",
          Item: {
            PK: `SESSION#${request.sessionId}`,
            SK: `SCAN#${timestamp}#${requestId}`,
            entityType: "SCAN",
            sessionId: request.sessionId,
            sku: request.sku,
            kioskId: request.kioskId,
            createdAt: timestamp,
            source: "staff",
            requestId,
          },
        },
      });
    }

    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems,
    }));

    return res(200, {
      message: "Request updated",
      status: targetStatus,
      autoScan: targetStatus === "DELIVERED",
    });
  } catch (error) {
    console.error("Error updating request:", error);

    if (error.name === "TransactionCanceledException" || error.name === "ConditionalCheckFailedException") {
      return res(409, {
        error: "Request status changed before this update completed.",
      });
    }

    return res(500, { error: "Internal server error" });
  }
};
