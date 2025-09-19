// Grundkod skrev Tobias, vi satt därefter och livekodade tillsammans för att få ihop den.
const { PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const { ddb } = require("../../lib/db");
const { pricePerType, capacityPerType } = require("../../lib/pricing");
const { newId } = require("../../lib/id");
const { DbError, BadRequestError, toHttpStatus } = require("../../lib/errors"); 

const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";

exports.handler = async (event) => {
  try {
    const body = safeJson(event.body);
    if (!body) throw new BadRequestError("ogiltig JSON i body"); 

    const { guests, nights, rooms, name, email } = body || {};

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new BadRequestError("namn är obligatoriskt"); 
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestError("email är obligatoriskt");
    }
    if (!Number.isInteger(guests) || guests <= 0) {
      throw new BadRequestError("antal gäster måste vara ett positivt heltal");
    }
    if (!Number.isInteger(nights) || nights <= 0) {
      throw new BadRequestError("antal nätter måste vara ett positivt heltal");
    }
    if (!Array.isArray(rooms) || rooms.length === 0) {
      throw new BadRequestError("rum måste vara en array som inte är tom");
    }

    for (const r of rooms) {
      if (!r || typeof r !== "object") {
        throw new BadRequestError("varje rum måste vara ett objekt");
      }
      const { type, qty } = r;
      if (!pricePerType[type] || !capacityPerType[type]) {
        throw new BadRequestError(`ogiltig rumstyp: ${type}`);
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new BadRequestError("antal rum måste vara ett positivt heltal");
      }
    }

    const totalCapacity = rooms.reduce((sum, r) => sum + capacityPerType[r.type] * r.qty, 0);
    if (guests > totalCapacity) {
      throw new BadRequestError("antal gäster överstiger rummens totala kapacitet");
    }

    const pricePerNight = rooms.reduce((sum, r) => sum + pricePerType[r.type] * r.qty, 0);
    const totalPrice = pricePerNight * nights;

    const bookingId = newId();
    const now = new Date().toISOString();
    const checkin = new Date().toISOString().split("T")[0];
    const checkout = new Date(Date.now() + nights * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const item = {
      PK: `BOOKING#${bookingId}`,
      SK: `BOOKING#${bookingId}`,
      GSI1PK: "BOOKING",
      GSI1SK: `CREATED_AT#${now}`,

      bookingId,
      name,
      email,
      guests,
      nights,
      rooms,
      totalPrice,
      status: "CONFIRMED",
      checkIn: checkin,
      checkOut: checkout,
      createdAt: now,
    };

    try {
      await ddb().send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(item, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(PK)",
      }));
    } catch (e) {
      console.error("PutItem error:", e);
      throw new DbError("kunde inte spara bokningen i databasen");
    }

    return json(201, { ok: true, data: item });
  } catch (err) {
    console.error("createBooking error:", err);
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

function safeJson(str) {
  if (!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch { return null; }
}