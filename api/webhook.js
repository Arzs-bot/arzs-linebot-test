export const config = {
  api: { bodyParser: false }
};

import { buffer } from 'micro';
import fetch from 'node-fetch';

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const rawBody = await buffer(req);
    const jsonBody = JSON.parse(rawBody.toString());
    const events = jsonBody.events || [];

    res.status(200).send('OK'); // 避免超時

    for (const event of events) {
      const userId = event.source?.userId || '';
      console.log("📥 收到事件 type:", event.type);
      console.log("👤 來自 userId:", userId);

      const displayName = await getUserDisplayName(userId);
      console.log("📛 使用者名稱：", displayName || "❓ 無法取得");

      if (event.type === 'message' && event.message?.type === 'text') {
        console.log("📩 對話內容：", event.message.text);
      }

      if (event.type === 'postback') {
        const postbackData = JSON.parse(event.postback.data); // e.g. { checkStage: "1", orderNo: "250610-123" }

        const payload = {
          orderNo: postbackData.orderNo,
          checkStage: postbackData.checkStage,
          user: displayName || "未知使用者",
          timestamp: new Date().toISOString()
        };

        const sheetsWebhook = 'https://script.google.com/macros/s/AKfycbyhjG2yeGuJoSU3vGOaYRAHI4O4qgTH-5v-bph-hHTi-dKpb7WS2vVcKOF5e8hjz9Mh/exec';
        const result = await postToSheetsWithRetry(payload, sheetsWebhook, 3);

        if (result.success) {
          console.log("📤 Sheets webhook 寫入成功：", result.response);
        } else {
          console.error("❌ Sheets webhook 寫入失敗：", result.error);
        }
      }
    }

  } catch (err) {
    console.error("❌ webhook 錯誤：", err);
  }
}

async function getUserDisplayName(userId) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${LINE_TOKEN}`
      }
    });

    if (!res.ok) {
      console.warn("⚠️ 無法取得使用者名稱，Status:", res.status);
      return null;
    }

    const json = await res.json();
    return json.displayName;
  } catch (err) {
    console.error("❌ getUserDisplayName 錯誤：", err);
    return null;
  }
}

async function postToSheetsWithRetry(payload, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} - ${text}`);
      return { success: true, response: text };
    } catch (err) {
      console.warn(`⚠️ Retry ${attempt} 失敗:`, err.message);
      if (attempt === maxRetries) {
        return { success: false, error: err.message };
      }
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
}
