// /api/webhook.js
import { buffer } from 'micro';
import fetch from 'node-fetch';
import * as admin from 'firebase-admin';

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbyhjG2yeGuJoSU3vGOaYRAHI4O4qgTH-5v-bph-hHTi-dKpb7WS2vVcKOF5e8hjz9Mh/exec';
const delayContext = new Map();

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

      // ✅ Firestore 寫入
      try {
        await db.collection('line-events').add({
          receivedAt: admin.firestore.Timestamp.now(),
          source: event.source || {},
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

      if (event.type === 'message' && event.message?.type === 'text') {
        const pending = delayContext.get(userId);
        if (pending?.orderNo && pending?.stageIndex) {
          const payload = {
            action: "delayReason",
            orderNo: pending.orderNo,
            stageIndex: pending.stageIndex,
            delayReason: event.message.text,
            user: displayName || "未知使用者",
            userId,
            timestamp: new Date().toISOString()
          };

          const result = await postToSheetsWithRetry(payload, SHEETS_WEBHOOK, 3);
          if (result.success) {
            console.log("✅ 延遲原因已寫入 Sheets：", event.message.text);
            delayContext.delete(userId);
          } else {
            console.error("❌ 延遲原因寫入失敗：", result.error);
          }
        }
      }

      if (event.type === 'postback') {
        const data = JSON.parse(event.postback.data || '{}');
        console.log("📦 postback 資料：", data);

        const now = new Date().toISOString();

        if (data.action === "delay") {
          delayContext.set(userId, {
            orderNo: data.orderNo,
            stageIndex: data.stageIndex
          });

          await sendLineMessage(userId, "⚠️ 請說明延遲原因（請用文字訊息回覆）");
          console.log("🕒 等待使用者回傳延遲原因");
        }

        const payload = {
          ...data,
          user: displayName || "未知使用者",
          userId,
          timestamp: now
        };

        const result = await postToSheetsWithRetry(payload, SHEETS_WEBHOOK, 3);
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

async function getUserDisplayName(userId, maxRetries = 3) {
  const url = `https://api.line.me/v2/bot/profile/${userId}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // ⏱️ 延長 timeout

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

async function postToSheetsWithRetry(payload, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise(r => setTimeout(r, 250 * attempt));
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
    }
  }
}

async function sendLineMessage(to, text) {
  if (!to || !text || text.trim() === '') return;

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }]
    })
  });
}
