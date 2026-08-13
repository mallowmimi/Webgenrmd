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
      return res.status(500).json({ error: 'API Key belum dipasang di Environment Variables Vercel.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // MODEL VERSI STABIL & TERBARU
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userPrompt = req.body.prompt || 'Gabungkan gambar-gambar ini secara harmonis untuk promosi produk affiliate.';
    const files = req.files || [];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Tidak ada gambar yang diunggah.' });
    }

    const imageParts = files.map((file) => ({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    }));

    const systemPrompt = `Kamu adalah Prompt Engineer profesional untuk AI Image Generator (seperti Midjourney / Flux / Imagen).
Tugasmu adalah menganalisis gambar produk dan/atau foto karakter yang diberikan, lalu buatkan 1 PROMPT BAHASA INGGRIS yang sangat detail untuk menghasilkan foto promosi produk yang realistis dan estetik.

Ketentuan:
1. Pertahankan ciri wajah/karakter jika ada foto karakter tersimpan.
2. Tampilkan detail produk secara akurat.
3. Sertakan detail pencahayaan dan gaya fotografi (photorealistic, 8k, soft lighting, commercial product photo).
4. Hasil keluaran HANYA berupa teks prompt Bahasa Inggris siap pakai.`;

    const contents = [systemPrompt, userPrompt, ...imageParts];

    const result = await model.generateContent(contents);
    const responseText = await result.response.text();

    return res.status(200).json({ result: responseText });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server.' });
  }
}
