export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const events = req.body.events;
  if (!events || events.length === 0) {
    return res.status(200).send("No event");
  }

  const event = events[0];
  const source = event.source;

  if (source.type === "group") {
    console.log("✅ 群組 ID:", source.groupId);
  } else {
    console.log("📩 來自來源:", source.type);
  }

  return res.status(200).send("OK");
}
