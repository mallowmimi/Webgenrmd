import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

export const config = {
  api: {
    bodyParser: false,
  },
};

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await runMiddleware(req, res, upload.array('images', 5));

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key belum dipasang di Environment Variables Vercel.' });
    }

    const userPrompt = req.body.prompt || 'Buatkan prompt promosi affiliate yang menarik.';
    const files = req.files || [];

    const parts = [
      {
        text: `Bertindaklah sebagai AI Prompt Engineer profesional e-commerce. Analisis gambar dan berikan 1 prompt Bahasa Inggris detail: ${userPrompt}`
      }
    ];

    files.forEach((file) => {
      parts.push({
        inline_data: {
          mime_type: file.mimetype,
          data: file.buffer.toString('base64')
        }
      });
    });

    // Menggunakan ENDPOINT STABLE (v1) bukan v1beta
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: parts }]
      })
    });

    const data = await apiRes.json();

    if (apiRes.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(200).json({ result: data.candidates[0].content.parts[0].text });
    } else {
      // Fallback cadangan jika v1 gemini-2.5-flash gagal, coba gemini-1.5-flash di v1
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const fbRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: parts }] })
      });
      const fbData = await fbRes.json();

      if (fbRes.ok && fbData.candidates && fbData.candidates[0]?.content?.parts[0]?.text) {
        return res.status(200).json({ result: fbData.candidates[0].content.parts[0].text });
      }

      return res.status(500).json({ error: `Google API Error: ${data.error?.message || JSON.stringify(data)}` });
    }

  } catch (error) {
    console.error('Error detail:', error);
    return res.status(500).json({ error: error.message });
  }
}
