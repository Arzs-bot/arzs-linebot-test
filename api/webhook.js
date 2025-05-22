export const config = {
  api: { bodyParser: false }
};

import { buffer } from 'micro';
import fetch from 'node-fetch';

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbyhjG2yeGuJoSU3vGOaYRAHI4O4qgTH-5v-bph-hHTi-dKpb7WS2vVcKOF5e8hjz9Mh/exec';

const delayContext = new Map();

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

      // 🔹 延遲原因輸入處理
      if (event.type === 'message' && event.message?.type === 'text') {
        console.log("📩 對話內容：", event.message.text);

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

      // 🔸 處理 FLEX postback 按鈕
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
      const timeout = setTimeout(() => controller.abort(), 3000); // 3 秒 timeout

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
        console.error("❌ getUserDisplayName 錯誤：", err);
        return null;
      }
      await new Promise(res => setTimeout(res, 500 * attempt)); // 逐次等待更久
    }
  }
}


async function postToSheetsWithRetry(payload, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise(r => setTimeout(r, 250 * attempt)); // ← 加延遲
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
