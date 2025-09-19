const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-north-1";

let _client;
function ddb() {
  if (!_client) {
    _client = new DynamoDBClient({ region: REGION });
  }
  return _client;
}

module.exports = { ddb };