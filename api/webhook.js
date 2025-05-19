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

    // ✅ 優先回應 LINE 避免超時
    res.status(200).send('OK');

    for (const event of events) {
      console.log("📥 收到事件 type:", event.type);
      const userId = event.source?.userId || '(無 userId)';
      console.log("👤 來自 userId:", userId);

      // ✅ 查詢 LINE 使用者名稱
      try {
        const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
          headers: {
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          }
        });

        if (profileRes.ok) {
          const profile = await profileRes.json();
          console.log(`👤 使用者名稱：${profile.displayName}`);
        } else {
          console.log('⚠️ 無法取得使用者名稱');
        }
      } catch (err) {
        console.error('❌ 查詢 LINE 使用者名稱失敗:', err);
      }

      // 顯示 message 內容
      if (event.type === 'message') {
        const msgType = event.message?.type || '(未知類型)';
        const msgText = event.message?.text || '(無文字內容)';
        console.log(`💬 收到訊息（${msgType}）from ${userId}: ${msgText}`);
      }

      // Postback 處理
      if (event.type === 'postback') {
        const postbackData = JSON.parse(event.postback.data || '{}');
        console.log("✅ Postback data:", postbackData);

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
    // 不回傳 500，因為前面已 res.send()
  }
}
