// Netlify Function webhook receiver for the Keyhole payment provider.
// Configure provider-specific signature verification before processing payment events.

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, endpoint: "keyhole-payment-webhook" }) };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "GET, POST" }, body: "Method Not Allowed" };
  }

  // Do not grant access or fulfill purchases here until the payment
  // provider's webhook signature/authentication requirements are configured.
  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Invalid JSON" }; }

  console.log("Payment webhook received", {
    eventType: payload.type || payload.event || "unknown",
    hasPayload: Boolean(event.body)
  });

  return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ received: true }) };
};
