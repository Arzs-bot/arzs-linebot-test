// /api/webhook.js
import { buffer } from 'micro';
import fetch from 'node-fetch';
import * as admin from 'firebase-admin';

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const rawBody = await buffer(req);
    const jsonBody = JSON.parse(rawBody.toString());
    const events = jsonBody.events || [];

    res.status(200).send('OK');

    for (const event of events) {
      const userId = event.source?.userId || '';
      console.log("📥 收到事件 type:", event.type);
      console.log("👤 來自 userId:", userId);

      const displayName = await getUserDisplayName(userId);
      console.log("📛 使用者名稱：", displayName || "❓ 無法取得");

      // ✅ 強制寫入 Firestore，不依賴條件
      console.log("🟡 即將寫入 Firestore");
      try {
        await db.collection('line-events').add({
          receivedAt: admin.firestore.Timestamp.now(),
          type: event.type,
          message: event.message || null,
          postback: event.postback || null,
          userId,
          displayName: displayName || "未知使用者",
          raw: event
        });
        console.log("✅ Firestore 寫入成功");
      } catch (error) {
        console.error("❌ Firestore 寫入錯誤:", error);
      }
    }

  } catch (err) {
    console.error("❌ webhook 錯誤：", err);
  }
}

async function getUserDisplayName(userId, maxRetries = 3) {
  const url = `https://api.line.me/v2/bot/profile/${userId}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${LINE_TOKEN}` },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) throw new Error(`LINE API 回應失敗：${res.status}`);
      const json = await res.json();
      return json.displayName;

    } catch (err) {
      console.warn(`⚠️ getUserDisplayName 第 ${attempt} 次失敗:`, err.message);
      if (attempt === maxRetries) {
        console.error("❌ getUserDisplayName 最終失敗：", err);
        return null;
      }
      await new Promise(res => setTimeout(res, 500 * attempt));
    }
  }
}
