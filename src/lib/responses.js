const headers = { "Content-Type": "application/json" };
const success = (data,statusCode=200)=>({ statusCode, headers, body: JSON.stringify({ ok:true, data }) });
const fail = (err,statusCode=500)=>({ statusCode, headers, body: JSON.stringify({ ok:false, error:{ name: err?.name||"Error", message: err?.message||"Unexpected error", code: err?.code } }) });
module.exports = { success, fail };