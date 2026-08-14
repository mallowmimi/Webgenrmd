import { GoogleGenerativeAI } from '@google/generative-ai';
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
      return res.status(500).json({ error: 'API Key belum dipasang di Vercel.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const userPrompt = req.body.prompt || 'Buatkan prompt promosi affiliate yang menarik.';
    const files = req.files || [];

    // Konversi gambar ke format inlineData SDK
    const imageParts = files.map((file) => ({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    }));

    const promptText = `Bertindaklah sebagai AI Prompt Engineer profesional e-commerce. Analisis gambar dan berikan 1 prompt Bahasa Inggris detail: ${userPrompt}`;

    // DAFTAR MODEL BARU TAHUN 2026 UNTUK FREE TIER
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash-exp'
    ];

    let lastError = null;

    // Loop otomatis cari model 2.x mana yang aktif di kunci API kamu
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([promptText, ...imageParts]);
        const responseText = result.response.text();

        if (responseText) {
          return res.status(200).json({ result: responseText });
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return res.status(500).json({ error: `Semua model gagal. Error terakhir: ${lastError}` });

  } catch (error) {
    console.error('Error detail:', error);
    return res.status(500).json({ error: error.message });
  }
}
