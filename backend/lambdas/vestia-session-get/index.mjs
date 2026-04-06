import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

function parseTimestamp(value, fallback = 0) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => parseTimestamp(a.createdAt, Number.MAX_SAFE_INTEGER) - parseTimestamp(b.createdAt, Number.MAX_SAFE_INTEGER));
}

function normalizeReconstructedRequest(state) {
  return {
    entityType: "REQUEST",
    requestId: state.requestId,
    sessionId: state.sessionId,
    storeId: state.storeId,
    kioskId: state.kioskId,
    sku: state.sku,
    requestType: state.requestType || "general",
    requestedSize: state.requestedSize ?? null,
    requestedColor: state.requestedColor ?? null,
    status: state.status,
    employeeId: state.employeeId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt || state.createdAt,
    claimedAt: state.claimedAt,
    deliveredAt: state.deliveredAt,
    cancelledAt: state.cancelledAt,
  };
}

function reconstructRequestsFromEvents(events) {
  const byRequestId = new Map();

  for (const event of sortByCreatedAt(events)) {
    const requestId = event.requestId;
    if (!requestId) continue;

    const current = byRequestId.get(requestId) || {
      requestId,
      sessionId: event.sessionId,
      storeId: event.storeId,
      kioskId: event.kioskId,
      sku: event.sku,
      requestType: event.requestType,
      requestedSize: event.requestedSize ?? null,
      requestedColor: event.requestedColor ?? null,
      status: "QUEUED",
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    };

    current.sessionId = event.sessionId || current.sessionId;
    current.storeId = event.storeId || current.storeId;
    current.kioskId = event.kioskId || current.kioskId;
    current.sku = event.sku || current.sku;
    current.requestType = event.requestType || current.requestType;
    current.requestedSize = event.requestedSize ?? current.requestedSize ?? null;
    current.requestedColor = event.requestedColor ?? current.requestedColor ?? null;
    current.updatedAt = event.createdAt || current.updatedAt;

    if (event.eventType === "REQUEST_CREATED") {
      current.status = "QUEUED";
      current.createdAt = event.createdAt;
    }

    if (event.eventType === "REQUEST_CLAIMED") {
      current.status = "CLAIMED";
      current.employeeId = event.employeeId || current.employeeId;
      current.claimedAt = event.createdAt;
    }

    if (event.eventType === "REQUEST_DELIVERED") {
      current.status = "DELIVERED";
      current.deliveredAt = event.createdAt;
      if (event.employeeId) current.employeeId = event.employeeId;
    }

    if (event.eventType === "REQUEST_CANCELLED") {
      current.status = "CANCELLED";
      current.cancelledAt = event.createdAt;
      if (event.employeeId) current.employeeId = event.employeeId;
    }

    byRequestId.set(requestId, current);
  }

  return Array.from(byRequestId.values()).map(normalizeReconstructedRequest);
}

function normalizeLegacyRequests(items) {
  return items
    .filter(item => item.entityType === "REQUEST")
    .map(item => ({
      ...item,
      entityType: "REQUEST",
    }));
}

function buildSessionItems(rawItems) {
  const requestEvents = rawItems.filter(item => item.entityType === "REQUEST_EVENT");
  const reconstructedRequests = reconstructRequestsFromEvents(requestEvents);
  const reconstructedRequestIds = new Set(reconstructedRequests.map(item => item.requestId));
  const legacyRequests = normalizeLegacyRequests(rawItems)
    .filter(item => !reconstructedRequestIds.has(item.requestId));
  const requestItems = [...reconstructedRequests, ...legacyRequests];

  const passthroughItems = rawItems.filter(item => {
    if (item.entityType === "REQUEST_EVENT") return false;
    if (item.entityType === "REQUEST") return false;
    return true;
  });

  return sortByCreatedAt([...passthroughItems, ...requestItems]);
}

export const handler = async (event) => {
  try {
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "sessionId required" }),
      };
    }

    const result = await client.send(
      new QueryCommand({
        TableName: "VestiaSessions",
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `SESSION#${sessionId}`,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId,
        items: buildSessionItems(result.Items || []),
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
