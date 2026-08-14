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

    // Ambil & bersihkan API Key dari spasi tidak sengaja
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key belum dipasang di Environment Variables Vercel.' });
    }

    const userPrompt = req.body.prompt || 'Buatkan prompt promosi affiliate yang menarik.';
    const files = req.files || [];

    // Susun data teks dan gambar untuk API Google
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

    // Daftar nama model resmi Google dari yang terbaru
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    let resultText = null;
    let lastError = '';

    // Loop otomatis untuk menembak API Google secara langsung
    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }]
        })
      });

      const data = await apiRes.json();

      if (apiRes.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        resultText = data.candidates[0].content.parts[0].text;
        break; // Jika berhasil, langsung keluar dari loop
      } else {
        lastError = data.error?.message || JSON.stringify(data);
      }
    }

    if (resultText) {
      return res.status(200).json({ result: resultText });
    } else {
      return res.status(500).json({ error: `Google API Error: ${lastError}` });
    }

  } catch (error) {
    console.error('Error detail:', error);
    return res.status(500).json({ error: error.message });
  }
}
