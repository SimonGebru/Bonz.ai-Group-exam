const { BadRequestError } = require("./errors");
function parseJsonBody(event){
  if(!event || typeof event.body !== "string") throw new BadRequestError("missing JSON body");
  try { return JSON.parse(event.body); } catch { throw new BadRequestError("invalid JSON body"); }
}
module.exports = { parseJsonBody };