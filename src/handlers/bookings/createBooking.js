// Grundkod skrev Tobias, vi satt därefter och livekodade tillsammans för att få ihop den. 

const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const { pricePerType, capacityPerType } = require("../../lib/pricing");
const { newId } = require("../../lib/id");

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-north-1";
const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";
const ddb = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    const body = safeJson(event.body);
    const { guests, nights, rooms } = body || {};

    
    if (!Number.isInteger(guests) || guests <= 0) {
      return json(400, { ok: false, error: { message: "antal gäster måste vara ett positivt heltal" } });
    }
    if (!Number.isInteger(nights) || nights <= 0) {
      return json(400, { ok: false, error: { message: "antal nätter måste vara ett positivt heltal" } });
    }
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return json(400, { ok: false, error: { message: "rum måste vara en array som inte är tom" } });
    }

    
    for (const r of rooms) {
      if (!r || typeof r !== "object") {
        return json(400, { ok: false, error: { message: "varje rum måste vara ett objekt" } });
      }
      const { type, qty } = r;
      if (!pricePerType[type] || !capacityPerType[type]) {
        return json(400, { ok: false, error: { message: `ogiltig rumstyp: ${type}` } });
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        return json(400, { ok: false, error: { message: "antal rum måste vara ett positivt heltal" } });
      }
    }

   
    const totalCapacity = rooms.reduce((sum, r) => sum + capacityPerType[r.type] * r.qty, 0);
    if (guests > totalCapacity) {
      return json(400, { ok: false, error: { message: "antal gäster överstiger rummens totala kapacitet" } });
    }

    const pricePerNight = rooms.reduce((sum, r) => sum + pricePerType[r.type] * r.qty, 0);
    const totalPrice = pricePerNight * nights;

    
    const bookingId = newId();
    const now = new Date().toISOString();

    const item = {
      PK: `BOOKING#${bookingId}`,
      SK: `BOOKING#${bookingId}`,
      GSI1PK: "BOOKING",
      GSI1SK: `CREATED_AT#${now}`,

      bookingId,
      guests,
      nights,
      rooms,       
      totalPrice,
      status: "CONFIRMED",
      createdAt: now,
    };

    await ddb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_not_exists(PK)", 
    }));

    return json(201, { ok: true, data: item });
  } catch (err) {
    console.error("createBooking error:", err);
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

function safeJson(str) {
  if (!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch { return null; }
}