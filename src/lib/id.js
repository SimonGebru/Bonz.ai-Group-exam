function newId(){
    return global.crypto?.randomUUID ? global.crypto.randomUUID() : require("crypto").randomBytes(16).toString("hex");
  }
  module.exports = { newId };