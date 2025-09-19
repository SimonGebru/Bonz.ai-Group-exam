const { QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { ddb } = require("../../lib/db");
const { BadRequestError, DbError, toHttpStatus } = require("../../lib/errors"); 

const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";

exports.handler = async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const limit = qs.limit ? Number(qs.limit) : 20;

    if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
      throw new BadRequestError("limit måste vara mellan 1 och 100"); 
    }

    let ExclusiveStartKey;
    if (qs.nextToken) {
      try {
        ExclusiveStartKey = JSON.parse(
          Buffer.from(qs.nextToken, "base64").toString("utf-8")
        );
      } catch {
        throw new BadRequestError("invalid nextToken"); 
      }
    }

    const params = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": { S: "BOOKING" } },
      ScanIndexForward: false, 
      Limit: limit,
      ExclusiveStartKey,
    };

    let res;
    try {
      res = await ddb().send(new QueryCommand(params));
    } catch (e) {
      console.error("Query error:", e);
      throw new DbError("kunde inte hämta bokningar"); 
    }

    const raw = (res.Items || []).map(unmarshall);

    
    const items = raw.map((b) => ({
      bookingId: b.bookingId,
      checkIn: b.checkIn || null,
      checkOut: b.checkOut || null,
      guests: b.guests,
      roomsCount: (b.rooms || []).reduce((sum, r) => sum + (r.qty || 0), 0),
      name: b.name || b.guestName || "",
    }));

    let nextToken;
    if (res.LastEvaluatedKey) {
      nextToken = Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64");
    }

    return json(200, { ok: true, data: { items, nextToken } });
  } catch (err) {
    console.error("listBookings error:", err);
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