export const config = {
  api: { bodyParser: false }
};

import { buffer } from 'micro';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const rawBody = await buffer(req);
    const jsonBody = JSON.parse(rawBody.toString());
    const events = jsonBody.events || [];

    // ✅ 馬上回應 LINE：避免 timeout
    res.status(200).send('OK');

    for (const event of events) {
      console.log("📥 收到事件 type:", event.type);

      if (event.type === 'postback') {
        const postbackData = JSON.parse(event.postback.data);
        const userId = event.source?.userId || '';

        console.log("✅ Postback data:", postbackData);

        const sheetsWebhook = 'https://script.google.com/macros/s/AKfycbyhjG2yeGuJoSU3vGOaYRAHI4O4qgTH-5v-bph-hHTi-dKpb7WS2vVcKOF5e8hjz9Mh/exec';

        // ✅ 非同步發送，不等待
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
    // 不用再 res.status(500)，因為已經送出 200
  }
}
