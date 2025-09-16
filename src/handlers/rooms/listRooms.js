const { pricePerType, capacityPerType } = require("../../lib/pricing");

exports.handler = async () => {
  const rooms = Object.keys(pricePerType).map((type) => ({
    type,
    pricePerNight: pricePerType[type],
    capacity: capacityPerType[type],
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, data: { rooms } }),
  };
};