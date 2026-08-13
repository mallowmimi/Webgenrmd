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
      if (result instanceof Error) {
        return reject(result);
      }
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key belum dipasang di Vercel.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // MENGGUNAKAN GEMINI-1.5-FLASH STANDAR YANG PALING STABIL
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const userPrompt = req.body.prompt || 'Buatkan prompt promosi affiliate.';
    const files = req.files || [];

    const imageParts = files.map((file) => ({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    }));

    const promptText = `Bertindaklah sebagai AI Prompt Engineer profesional untuk konten e-commerce. Analisis gambar ini dan berikan 1 prompt Bahasa Inggris yang sangat detail untuk image generator: ${userPrompt}`;

    const contents = [promptText, ...imageParts];

    const result = await model.generateContent(contents);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ result: text });
  } catch (error) {
    console.error('Error detail:', error);
    return res.status(500).json({ error: error.message });
  }
}
