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

    // Format masukan untuk Interactions API
    const inputs = [
      {
        text: `Bertindaklah sebagai AI Prompt Engineer profesional e-commerce. Analisis gambar dan berikan 1 prompt Bahasa Inggris detail: ${userPrompt}`
      }
    ];

    files.forEach((file) => {
      inputs.push({
        inline_data: {
          mime_type: file.mimetype,
          data: file.buffer.toString('base64')
        }
      });
    });

    // Menggunakan ENDPOINT INTERACTIONS API TERBARU SESUAI INSTRUKSI GOOGLE
    const url = `https://generativelanguage.googleapis.com/v1/interactions?key=${apiKey}`;

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        input: inputs
      })
    });

    const data = await apiRes.json();

    if (apiRes.ok && data.outputs && data.outputs[0]?.text) {
      return res.status(200).json({ result: data.outputs[0].text });
    } else if (data.choices && data.choices[0]?.message?.content) {
      return res.status(200).json({ result: data.choices[0].content });
    } else {
      return res.status(500).json({ error: `Google API Error: ${data.error?.message || JSON.stringify(data)}` });
    }

  } catch (error) {
    console.error('Error detail:', error);
    return res.status(500).json({ error: error.message });
  }
}
