import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event) => {
  try {
    const requestId = event.pathParameters?.requestId;
    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event.body;

    const {
      storeId,
      sessionId,
      status,
      employeeId,
      sku,
      requestedSize,
      requestedColor,
      category
    } = body;

    if (!requestId || !storeId || !sessionId || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "requestId, storeId, sessionId, and status are required"
        })
      };
    }

    const updatedAt = new Date().toISOString();

    // 🔁 Shared update expression
    const updateExpression = `
      SET #status = :status,
          updatedAt = :updatedAt
          ${employeeId ? ", employeeId = :employeeId" : ""}
    `;

    const expressionNames = {
      "#status": "status"
    };

    const expressionValues = {
      ":status": status,
      ":updatedAt": updatedAt
    };

    if (employeeId) {
      expressionValues[":employeeId"] = employeeId;
    }

    // 1️⃣ Update STORE record (staff dashboard)
    await client.send(
      new UpdateCommand({
        TableName: "VestiaSessions",
        Key: {
          PK: `STORE#${storeId}`,
          SK: `REQUEST#${requestId}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues
      })
    );

    // 2️⃣ Update SESSION record (kiosk view)
    await client.send(
      new UpdateCommand({
        TableName: "VestiaSessions",
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: `REQUEST#${requestId}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues
      })
    );

    // 3️⃣ 🔥 If delivered → auto-create SCAN
    if (status === "DELIVERED") {
      const scanTimestamp = new Date().toISOString();

      await client.send(
        new PutCommand({
          TableName: "VestiaSessions",
          Item: {
            PK: `SESSION#${sessionId}`,
            SK: `SCAN#${scanTimestamp}`,

            entityType: "SCAN",
            source: "REQUEST",

            requestId,
            sku,
            size: requestedSize || null,
            color: requestedColor || null,
            category: category || null,

            createdAt: scanTimestamp
          }
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Request updated",
        requestId,
        status,
        updatedAt
      })
    };

  } catch (err) {
    console.error("Update request error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};