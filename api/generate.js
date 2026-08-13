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

        const userPrompt = req.body.prompt || 'Gabungkan gambar-gambar ini.';
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Tidak ada gambar yang diunggah.' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const imageParts = files.map(file => ({
            inlineData: {
                data: file.buffer.toString("base64"),
                mimeType: file.mimetype
            }
        }));

        const promptText = `Analisis gambar-gambar berikut dan buatkan prompt gabungan detail: ${userPrompt}`;

        const result = await model.generateContent([promptText, ...imageParts]);
        const responseText = result.response.text();

        return res.status(200).json({ result: responseText });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
