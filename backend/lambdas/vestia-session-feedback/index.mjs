import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const {
      sessionId,
      overallRating,
      overallComment,
      itemFeedback,
      experienceRating,
      experienceComment,
      wouldReturn,
    } = JSON.parse(event.body || "{}");

    if (!sessionId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "sessionId is required" }),
      };
    }

    const timestamp = new Date().toISOString();
    const feedbackId = `FEEDBACK-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    await docClient.send(new PutCommand({
      TableName: "VestiaSessions",
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `FEEDBACK#${timestamp}`,
        entityType: "FEEDBACK",
        feedbackId,
        sessionId,
        overallRating: overallRating ?? null,
        overallComment: overallComment ?? null,
        itemFeedback: itemFeedback ?? [],
        experienceRating: experienceRating ?? null,
        experienceComment: experienceComment ?? null,
        wouldReturn: wouldReturn ?? null,
        createdAt: timestamp,
      },
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ feedbackId, message: "Feedback recorded" }),
    };
  } catch (error) {
    console.error("Feedback error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
