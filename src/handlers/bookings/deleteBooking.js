const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-north-1";
const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";
const ddb = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    const bookingId = event.pathParameters?.bookingId;

    if (!bookingId || typeof bookingId !== "string") {
      return json(400, { ok: false, error: { message: "bookingId måste anges i URL:en" } });
    }

    const Key = {
      PK: { S: `BOOKING#${bookingId}` },
      SK: { S: `BOOKING#${bookingId}` },
    };

    const command = new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key,
      ReturnValues: "ALL_OLD",
      ConditionExpression: "attribute_exists(PK)",
    });

    const result = await ddb.send(command);

    if (!result.Attributes) {
      return json(404, { ok: false, error: { message: "Booking not found" } });
    }

    return json(200, { ok: true, data: unmarshall(result.Attributes) });
  } catch (err) {
    console.error("deleteBooking error:", err);
    return json(500, { ok: false, error: { message: "Internal Server Error" } });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
