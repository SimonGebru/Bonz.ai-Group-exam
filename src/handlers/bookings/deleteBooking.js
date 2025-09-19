const { DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { ddb } = require("../../lib/db");
const { BadRequestError, NotFoundError, DbError, toHttpStatus } = require("../../lib/errors"); 

const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";

exports.handler = async (event) => {
  try {
    const bookingId = event.pathParameters?.bookingId;

    if (!bookingId || typeof bookingId !== "string") {
      throw new BadRequestError("bookingId måste anges i URL:en"); 
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

    let result;
    try {
      result = await ddb().send(command);
    } catch (e) {
      console.error("DeleteItem error:", e);
      throw new DbError("kunde inte ta bort bokningen"); 
    }

    if (!result.Attributes) {
      throw new NotFoundError("Booking not found"); 
    }

    return json(200, { ok: true, data: unmarshall(result.Attributes) });
  } catch (err) {
    console.error("deleteBooking error:", err);
    const status = toHttpStatus(err); 
    return json(status, { ok: false, error: { message: err.message } }); 
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body, null, 2),
  };
}