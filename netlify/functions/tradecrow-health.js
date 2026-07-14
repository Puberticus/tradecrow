const model = process.env.OPENAI_MODEL || "gpt-4.1";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  return json(200, {
    ok: true,
    hasKey: Boolean(process.env.OPENAI_API_KEY),
    model
  });
};
