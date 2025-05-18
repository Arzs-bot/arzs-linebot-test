export const config = {
  api: { bodyParser: false }
};

import { buffer } from 'micro';
import fetch from 'node-fetch'; // 確保已安裝 node-fetch

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const rawBody = await buffer(req);
    const jsonBody = JSON.parse(rawBody.toString());
    const events = jsonBody.events || [];

    for (const event of events) {
      console.log("📥 收到事件 type:", event.type);

      if (event.type === 'postback') {
        const postbackData = JSON.parse(event.postback.data);
        const userId = event.source?.userId || '';

        console.log("✅ Postback data:", postbackData);

        // ✅ 傳給 Google Sheets webhook
        const sheetsWebhook = 'https://script.google.com/macros/s/AKfycbyhjG2yeGuJoSU3vGOaYRAHI4O4qgTH-5v-bph-hHTi-dKpb7WS2vVcKOF5e8hjz9Mh/exec';

        const result = await fetch(sheetsWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...postbackData, userId })
        });

        const text = await result.text();
        console.log("📤 Google Sheets webhook 回應：", text);
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        console.log("💬 收到文字訊息:", event.message.text);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error("❌ webhook 執行錯誤：", err);
    res.status(500).send('Internal Server Error');
  }
}
