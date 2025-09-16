const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-north-1";
const TABLE_NAME = process.env.TABLE_NAME || "Bonzai";
const ddb = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const limit = qs.limit ? Number(qs.limit) : 20;
    if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
      return json(400, { ok: false, error: { message: "limit must be 1..100" } });
    }

    let ExclusiveStartKey;
    if (qs.nextToken) {
      try {
        ExclusiveStartKey = JSON.parse(Buffer.from(qs.nextToken, "base64").toString("utf-8"));
      } catch {
        return json(400, { ok: false, error: { message: "invalid nextToken" } });
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

    const res = await ddb.send(new QueryCommand(params));
    const items = (res.Items || []).map(unmarshall);

    let nextToken;
    if (res.LastEvaluatedKey) {
      nextToken = Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64");
    }

    return json(200, { ok: true, data: { items, nextToken } });
  } catch (err) {
    console.error("listBookings error:", err);
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