const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { pricePerType, capacityPerType } = require("../../lib/pricing");
const { ddb } = require("../../lib/db");
const { BadRequestError, NotFoundError, DbError, toHttpStatus } = require("../../lib/errors"); 

const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";
const ddbDocClient = DynamoDBDocumentClient.from(ddb());

exports.handler = async (event) => {
  try {
    const bookingId = event.pathParameters?.id;
    if (!bookingId) {
      throw new BadRequestError("Saknar bokningsID"); 
    }

    const updates = JSON.parse(event.body || "{}");

    if (Object.keys(updates).length === 0) {
      throw new BadRequestError("Ingen data att uppdatera"); 
    }

    let currentBooking;
    try {
      currentBooking = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `BOOKING#${bookingId}`,
            SK: `BOOKING#${bookingId}`,
          },
        })
      );
    } catch (e) {
      console.error("GetCommand error:", e);
      throw new DbError("kunde inte läsa bokningen"); 
    }

    if (!currentBooking.Item) {
      throw new NotFoundError("Ingen bokning hittad"); 
    }

    const rooms = updates.rooms || currentBooking.Item.rooms;
    const guests = updates.guests || currentBooking.Item.guests;
    const nights = updates.nights || currentBooking.Item.nights;
    const checkIn = updates.checkIn || currentBooking.Item.checkIn;
    const checkOut = updates.checkOut || currentBooking.Item.checkOut;

    const totalCapacity = rooms.reduce(
      (sum, r) => sum + capacityPerType[r.type] * r.qty,
      0
    );

    if (guests > totalCapacity) {
      throw new BadRequestError("För många gäster för angivet rum"); 
    }

    if (updates.rooms || updates.nights) {
      const pricePerNight = rooms.reduce(
        (sum, r) => sum + pricePerType[r.type] * r.qty,
        0
      );
      updates.totalPrice = pricePerNight * nights;
    }

    if (updates.checkIn || updates.checkOut) {
      if (new Date(checkIn) >= new Date(checkOut)) {
        throw new BadRequestError("Incheckning måste vara före utcheckning"); 
      }
    }

    updates.updatedAt = new Date().toISOString();

    let result;
    try {
      result = await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `BOOKING#${bookingId}`,
            SK: `BOOKING#${bookingId}`,
          },

          UpdateExpression: `SET ${Object.keys(updates)
            .map((key) => `#${key} = :${key}`)
            .join(", ")}`,

          ExpressionAttributeNames: Object.fromEntries(
            Object.keys(updates).map((key) => [`#${key}`, key])
          ),

          ExpressionAttributeValues: Object.fromEntries(
            Object.entries(updates).map(([key, value]) => [`:${key}`, value])
          ),

          ReturnValues: "ALL_NEW",
        })
      );
    } catch (e) {
      console.error("UpdateCommand error:", e);
      throw new DbError("kunde inte uppdatera bokningen"); 
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking: result.Attributes }),
    };
  } catch (err) {
    console.error("updateBooking error:", err);
    const status = toHttpStatus(err); 
    return {
      statusCode: status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Kunde inte uppdatera bokningen" }),
    };
  }
};
