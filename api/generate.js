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

    // Menyusun parts (teks + gambar)
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

    // FORMAT STRUKTUR MURNI SESUAI SPESIFIKASI INTERACTIONS API
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        input: parts
      })
    });

    const data = await apiRes.json();

    if (apiRes.ok) {
      // Ekstrak hasil teks dari respons
      let resultText = '';
      if (data.outputs && data.outputs.length > 0) {
        const firstOutput = data.outputs[0];
        if (firstOutput.text) {
          resultText = firstOutput.text;
        } else if (firstOutput.parts) {
          resultText = firstOutput.parts.map(p => p.text).join('\n');
        }
      }

      if (!resultText) {
        resultText = JSON.stringify(data);
      }

      return res.status(200).json({ result: resultText });
    } else {
      return res.status(500).json({ error: `Google API Error: ${data.error?.message || JSON.stringify(data)}` });
    }

  } catch (error) {
    console.error('Error detail:', error);
    return res.status(500).json({ error: error.message });
  }
}
