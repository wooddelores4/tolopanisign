
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY is not set in environment variables.");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
}

export const translateImageToText = async (base64ImageData: string): Promise<string> => {
    const geminiAI = getAI();
    
    const prompt = "Terjemahkan gestur bahasa isyarat Indonesia dalam gambar ini ke dalam teks Bahasa Indonesia. Berikan hanya teks terjemahannya, tanpa penjelasan tambahan. Jika isyarat tidak jelas, kembalikan string kosong.";

    try {
        const response = await geminiAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64ImageData,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
        });
        
        const text = response.text ?? '';
        return text.trim();

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get translation from Gemini API.");
    }
};

export const summarizeText = async (phrases: string[]): Promise<string> => {
    const geminiAI = getAI();
    const textToSummarize = phrases.join(' ');
    const prompt = `Dari kumpulan kata hasil terjemahan bahasa isyarat berikut: "${textToSummarize}", rangkailah menjadi satu kalimat yang utuh dan paling masuk akal dalam Bahasa Indonesia. Berikan hanya kalimat lengkapnya.`;

    try {
        const response = await geminiAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const text = response.text ?? '';
        return text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for summarization:", error);
        throw new Error("Failed to get summary from Gemini API.");
    }
};