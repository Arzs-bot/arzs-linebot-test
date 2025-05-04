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
    const errorText = await res.text();
    console.error("❌ LINE 回覆失敗：", errorText);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      console.log("⚠️ 沒有收到任何事件");
      return res.status(200).send("No event");
    }

    const event = events[0];
    const source = event.source?.type || "(無來源)";
    const replyToken = event.replyToken;
    const messageText = event.message?.text || "(無文字訊息)";
    const messageType = event.message?.type || "(無類型)";
    const eventType = event.type;

    console.log("📝 接收到事件：", { eventType, messageType, source, messageText });

    // 僅處理文字訊息
    if (eventType === "message" && messageType === "text") {
      await replyMessage(replyToken, `你剛說了：「${messageText}」`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ webhook 處理失敗：", err);
    res.status(500).send("Webhook Error");
  }
}
