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
    await runMiddleware(req, res, upload.array('images', 4));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key belum dipasang di Environment Variables Vercel.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // UPDATE MODEL NAME: Menggunakan gemini-2.5-flash (atau gemini-1.5-flash-latest)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const promptUser = req.body.prompt || '';
    const files = req.files || [];

    const imageParts = files.map((file) => ({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    }));

    const systemPrompt = `Kamu adalah seorang Prompt Engineer ahli untuk AI Image Generator (seperti Midjourney / Flux / Imagen) khusus untuk konten e-commerce & affiliate marketing.
Tugasmu adalah menganalisis gambar produk dan/atau karakter yang di-upload, lalu membuatkan 1 PROMPT BAHASA INGGRIS yang sangat detail dan presisi untuk menghasilkan foto produk promosi yang realistis, estetik, dan berkonversi tinggi.

Aturan Pembuatan Prompt:
1. Pertahankan fitur wajah/karakter utama jika ada foto karakter tersimpan/diupload.
2. Tampilkan produk dengan detail yang akurat.
3. Sertakan detail lighting (photorealistic, soft daylight, studio lighting, 8k resolution, cinematic).
4. Hasil keluaran HARUS HANYA PROMPT BAHASA INGGRIS siap pakai untuk image generator.`;

    const contents = [systemPrompt, promptUser, ...imageParts];

    const result = await model.generateContent(contents);
    const responseText = await result.response.text();

    return res.status(200).json({ result: responseText });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server.' });
  }
}
