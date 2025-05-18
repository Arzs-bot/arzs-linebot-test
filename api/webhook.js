export const config = {
  api: {
    bodyParser: false, // 告訴 Vercel 不要預設處理 JSON
  },
};

import { buffer } from 'micro';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const rawBody = await buffer(req);
    const jsonBody = JSON.parse(rawBody.toString());
    const events = jsonBody.events || [];

    for (const event of events) {
      console.log("📥 收到事件 type:", event.type);

      if (event.type === 'postback') {
        console.log("✅ 按下按鈕 - postback data:", event.postback.data);
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        console.log("💬 收到文字訊息:", event.message.text);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ webhook 解析錯誤:', err);
    res.status(500).send('Internal Server Error');
  }
}
