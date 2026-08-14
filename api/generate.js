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

    // Menyusun isi konten gambar dan teks
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

    const url = `https://generativelanguage.googleapis.com/v1/interactions?key=${apiKey}`;

    // FORMAT 'input' YANG DIMINTA GOOGLE (DENGAN FIELD TYPE ATAU ROLE YANG BENAR)
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        input: [
          {
            type: 'user_content',
            content: {
              role: 'user',
              parts: parts
            }
          }
        ]
      })
    });

    let data = await apiRes.json();

    // JIKA FORMAT STEP ERROR, FALLBACK KE FORMAT SIMPLE TURN
    if (!apiRes.ok && data.error?.message?.includes('type')) {
      const fallbackRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          input: [
            {
              role: 'user',
              parts: parts
            }
          ]
        })
      });
      data = await fallbackRes.json();
    }

    if (data.outputs && data.outputs.length > 0) {
      const out = data.outputs[0];
      const resultText = out.text || (out.parts ? out.parts.map(p => p.text).join('\n') : null) || JSON.stringify(out);
      return res.status(200).json({ result: resultText });
    } else if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(200).json({ result: data.candidates[0].content.parts[0].text });
    } else {
      return res.status(500).json({ error: `Google API Response: ${data.error?.message || JSON.stringify(data)}` });
    }

  } catch (error) {
    console.error('Error detail:', error);
    return res.status(500).json({ error: error.message });
  }
}
