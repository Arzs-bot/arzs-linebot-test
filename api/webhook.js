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
        const postbackData = JSON.parse(event.postback.data);
        const sheetsWebhook = 'https://script.google.com/macros/s/AKfycbyhjG2yeGuJoSU3vGOaYRAHI4O4qgTH-5v-bph-hHTi-dKpb7WS2vVcKOF5e8hjz9Mh/exec';

        fetch(sheetsWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...postbackData, userId })
        }).then(async r => {
          const result = await r.text();
          console.log("📤 Sheets webhook 回應：", result);
        }).catch(err => {
          console.error("❌ 發送 Sheets webhook 失敗：", err);
        });
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
