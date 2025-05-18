export const config = {
  api: { bodyParser: false }
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
        console.log("✅ postback data:", event.postback.data);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error("❌ webhook 錯誤：", err);
    res.status(500).send('Internal Server Error');
  }
}
