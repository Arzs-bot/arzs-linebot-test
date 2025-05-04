import fetch from "node-fetch";

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function replyMessage(replyToken, message) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: message }]
    })
  });

  if (!res.ok) {
    console.error("❌ LINE reply failed:", await res.text());
  }
}

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
    const text = event.message?.text || "（無文字）";
    const replyToken = event.replyToken;

    console.log("📩 收到訊息：", text);
    await replyMessage(replyToken, `你說了：「${text}」`);

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ webhook error:", err);
    res.status(500).send("Webhook Error");
  }
}
