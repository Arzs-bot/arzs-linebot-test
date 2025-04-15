export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      res.status(200).send("No event");
      return;
    }

    const event = events[0];
    const source = event.source;

    if (source.type === "group") {
      console.log("✅ 群組 ID:", source.groupId);
    } else {
      console.log("📩 來自來源:", source.type);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ webhook error:", err);
    res.status(500).send("Webhook Error");
  }
}
