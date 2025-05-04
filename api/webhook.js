import fetch from "node-fetch";

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function replyMessage(replyToken, message) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
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

// /api/webhook.js
import fetch from "node-fetch";
import { google } from "googleapis";

// 回覆訊息到 LINE
async function replyMessage(replyToken, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }]
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ LINE 回覆失敗：", errorText);
  }
}

// 呼叫 GPT-4o 處理報價內容
async function callGptQuoteParser(message) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const body = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `你是一個接單分析助理，請將以下訊息解析為報價資料，輸出格式為 JSON。欄位包括：\n客戶、品項、數量、工法、單價、總價（可空白，若無法推算）、備註。請勿添加其他說明文字。`
      },
      { role: "user", content: message }
    ],
    temperature: 0.4
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// 寫入報價暫存表
async function writeToQuotationSheet(data, rawMessage) {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });
  const sheetId = "12-K40Qpw92qVwVYyOCyaboizqHoZ9TernX0ouTuG3mE"; // ARZS 報價暫存表

  const now = new Date().toISOString();
  const row = [
    now,
    data.客戶 || "",
    data.品項 || "",
    data.數量 || "",
    data.工法 || "",
    data.單價 || "",
    data.總價 || "",
    data.備註 || "",
    rawMessage,
    "LINE GPT"
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "報價暫存表!A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });
}

// Webhook handler
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const events = req.body.events;
    if (!events || events.length === 0) return res.status(200).send("No event");

    const event = events[0];
    const messageText = event.message?.text;
    const replyToken = event.replyToken;

    if (messageText) {
      // 判斷是否為報價訊息
      if (messageText.includes("報價") || messageText.match(/\d+件/)) {
        const parsed = await callGptQuoteParser(messageText);
        await writeToQuotationSheet(parsed, messageText);

        const confirm = `✅ 報價已紀錄\n客戶：${parsed.客戶}\n品項：${parsed.品項}\n數量：${parsed.數量} 件\n單價：${parsed.單價}`;
        await replyMessage(replyToken, confirm);
        return res.status(200).send("OK");
      }

      // 若不是報價訊息，可做預設回覆
      await replyMessage(replyToken, `我收到你的訊息：「${messageText}」`);
      return res.status(200).send("OK");
    }
  } catch (err) {
    console.error("❌ webhook error:", err);
    return res.status(500).send("Webhook Error");
  }
}
