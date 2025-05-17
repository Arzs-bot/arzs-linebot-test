export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const events = req.body.events || [];
      if (events.length > 0) {
        const event = events[0];
        console.log('👤 userId:', event?.source?.userId);
        console.log('📩 message:', event?.message?.text);
      } else {
        console.log('📭 沒收到 events');
      }

      // ✅ 告訴 LINE 一切正常，避免 500 錯誤
      res.status(200).send('OK');
    } catch (err) {
      console.error('❌ Webhook 錯誤：', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
