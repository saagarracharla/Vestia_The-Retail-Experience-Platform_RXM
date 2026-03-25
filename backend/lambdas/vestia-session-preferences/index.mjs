/**
 * vestia-session-preferences Lambda
 * POST /session/preferences
 *
 * Stores customer style/size/color preferences captured during a session
 * (from the in-session preferences popup on the kiosk).
 * These are read back by vestia-recommend to adjust scores in real time.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  try {
    const {
      sessionId,
      preferredSizes,   // e.g. { top: "M", bottom: "32", shoes: "10" }
      preferredColors,  // e.g. ["black", "navy", "white"]
      preferredStyles,  // e.g. ["casual", "smart casual"]
    } = JSON.parse(event.body || "{}");

    if (!sessionId) {
      return res(400, { error: "sessionId is required" });
    }

    const timestamp = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: "VestiaSessions",
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `PREF#${timestamp}`,
        entityType: "SESSION_PREF",
        sessionId,
        preferredSizes:  preferredSizes  ?? {},
        preferredColors: preferredColors ?? [],
        preferredStyles: preferredStyles ?? [],
        createdAt: timestamp,
      },
    }));

    return res(200, { message: "Preferences saved" });
  } catch (err) {
    console.error("Preferences error:", err);
    return res(500, { error: "Internal server error" });
  }
};

function res(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}
