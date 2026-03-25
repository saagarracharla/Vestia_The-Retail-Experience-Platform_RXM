import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    try {
        const { requestId } = event.pathParameters;
        const body = JSON.parse(event.body);
        const { employeeId } = body;
        
        if (!requestId || !employeeId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "requestId and employeeId are required" })
            };
        }

        // Scan VestiaSessions to find REQUEST records by requestId
        const scanResponse = await docClient.send(new ScanCommand({
            TableName: "VestiaSessions",
            FilterExpression: "SK = :sk AND entityType = :entityType",
            ExpressionAttributeValues: {
                ":sk": `REQUEST#${requestId}`,
                ":entityType": "REQUEST"
            }
        }));

        if (!scanResponse.Items || scanResponse.Items.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Request not found" })
            };
        }

        // Extract sessionId and storeId from the first record
        const requestRecord = scanResponse.Items[0];
        const { sessionId, storeId } = requestRecord;

        // Update both SESSION# and STORE# records
        const timestamp = new Date().toISOString();
        
        await Promise.all([
            // Update session-side record
            docClient.send(new UpdateCommand({
                TableName: "VestiaSessions",
                Key: {
                    PK: `SESSION#${sessionId}`,
                    SK: `REQUEST#${requestId}`
                },
                UpdateExpression: "SET #status = :status, employeeId = :employeeId, claimedAt = :timestamp",
                ExpressionAttributeNames: {
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":status": "CLAIMED",
                    ":employeeId": employeeId,
                    ":timestamp": timestamp
                }
            })),
            // Update store-side record
            docClient.send(new UpdateCommand({
                TableName: "VestiaSessions",
                Key: {
                    PK: `STORE#${storeId}`,
                    SK: `REQUEST#${requestId}`
                },
                UpdateExpression: "SET #status = :status, employeeId = :employeeId, claimedAt = :timestamp",
                ExpressionAttributeNames: {
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":status": "CLAIMED",
                    ":employeeId": employeeId,
                    ":timestamp": timestamp
                }
            }))
        ]);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Request claimed successfully",
                requestId,
                status: "CLAIMED",
                employeeId,
                claimedAt: timestamp
            })
        };

    } catch (error) {
        console.error("Error claiming request:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
};
