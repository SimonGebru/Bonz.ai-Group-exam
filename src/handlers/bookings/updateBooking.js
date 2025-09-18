const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { pricePerType, capacityPerType } = require("../../lib/pricing");

const REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-north-1";
const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";
const client = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const bookingId = event.pathParameters?.id;
    if (!bookingId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Saknar bokningsID" }),
      };
    }

    const updates = JSON.parse(event.body || "{}");

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Ingen data att uppdatera" }),
      };
    }

    const currentBooking = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `BOOKING#${bookingId}`,
          SK: `BOOKING#${bookingId}`,
        },
      })
    );

    if (!currentBooking.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Ingen bokning hittad" }),
      };
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
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "För många gäster för angivet rum" }),
      };
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
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Incheckning måste vara före utcheckning",
          }),
        };
      }
    }

    updates.updatedAt = new Date().toISOString();

    const result = await ddbDocClient.send(
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

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ booking: result.Attributes }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Kunde inte uppdatera bokningen" }),
    };
  }
};
