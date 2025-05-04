import fetch from "node-fetch";

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

    // ✅ 判斷是否為文字訊息
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text;
      const replyToken = event.replyToken;

      // ✅ 若為「x月營業額」
      if (/^\d+月營業額$/.test(text)) {
        const month = parseInt(text.replace("月營業額", ""), 10);
        const apiUrl = `https://script.google.com/macros/s/AKfycbzMbBPWXlQ9y2oJZmb5DOD5330D-N1aqE9oZFfIOVUTLnjKyscfWkIoip3DGSsydXj8kQ/exec?month=${month}`;
        const result = await fetch(apiUrl);
        const replyText = await result.text();

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{ type: "text", text: replyText }],
          }),
        });

        return res.status(200).send("營業額已回覆");
      }
    }

    // 若不是查詢月營業額，就正常結束
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ webhook error:", err);
    res.status(500).send("Webhook Error");
  }
}
