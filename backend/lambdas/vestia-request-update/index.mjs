import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const { requestId } = event.pathParameters;
    const { status, action } = JSON.parse(event.body);
    
    if (!requestId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "requestId is required" })
      };
    }

    // Get request from store partition to get full details
    const storeQuery = await docClient.send(new GetCommand({
      TableName: "VestiaSessions",
      Key: {
        PK: "STORE#STORE-001",
        SK: `REQUEST#${requestId}`
      }
    }));

    if (!storeQuery.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Request not found" })
      };
    }

    const request = storeQuery.Item;
    const timestamp = new Date().toISOString();
    let newStatus = status;

    // Handle special "delivered" action
    if (action === "delivered") {
      newStatus = "DELIVERED";
      
      // Auto-create SCAN event when delivered
      const scanEvent = {
        PK: `SESSION#${request.sessionId}`,
        SK: `SCAN#${timestamp}`,
        entityType: "SCAN",
        sessionId: request.sessionId,
        sku: request.sku,
        kioskId: request.kioskId,
        createdAt: timestamp,
        source: "staff"
      };

      await docClient.send(new PutCommand({
        TableName: "VestiaSessions",
        Item: scanEvent
      }));
    }

    // Update both session and store partitions
    const updateParams = {
      TableName: "VestiaSessions",
      UpdateExpression: "SET #status = :status, updatedAt = :timestamp",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": newStatus,
        ":timestamp": timestamp
      }
    };

    // Update in session partition
    await docClient.send(new UpdateCommand({
      ...updateParams,
      Key: {
        PK: `SESSION#${request.sessionId}`,
        SK: `REQUEST#${requestId}`
      }
    }));

    // Update in store partition
    await docClient.send(new UpdateCommand({
      ...updateParams,
      Key: {
        PK: `STORE#${request.storeId}`,
        SK: `REQUEST#${requestId}`
      }
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: "Request updated",
        status: newStatus,
        autoScan: action === "delivered"
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
