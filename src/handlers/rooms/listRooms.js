exports.handler = async () => {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        data: {
          rooms: [
            { type: "single", pricePerNight: 500, capacity: 1 },
            { type: "double", pricePerNight: 1000, capacity: 2 },
            { type: "suite",  pricePerNight: 1500, capacity: 3 },
          ],
        },
      }),
    };
  };