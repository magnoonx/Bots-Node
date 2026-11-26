const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Transcripción vía Google Gemini AI (Soporta audio nativo multimodal OGG/Opus sin descargas locales)
 */
async function transcribeViaGemini(mediaBase64) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) return null;

    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    for (const modelSlug of models) {
        try {
            console.log(`🎙️ [STT Nube] Transcribiendo audio con Google Gemini (${modelSlug})...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelSlug}:generateContent?key=${geminiKey}`;
            const body = {
                contents: [{
                    parts: [
                        { inline_data: { mime_type: 'audio/ogg', data: mediaBase64 } },
                        { text: 'Transcribe este mensaje de voz a texto en español exactamente. Devuelve ÚNICAMENTE la transcripción sin explicaciones adicionales.' }
                    ]
                }]
            };

            const res = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 25000
            });

            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim().length > 0) {
                console.log(`🎙️ [STT Nube] Transcripción exitosa (Gemini): "${text.trim()}"`);
                return text.trim();
            }
        } catch (e) {
            console.warn(`⚠️ Error en audio Gemini (${modelSlug}):`, e.response?.data?.error?.message || e.message);
        }
    }
    return null;
}

/**
 * Transcripción vía Hugging Face Router (Whisper)
 */
async function transcribeViaHuggingFace(audioBuffer) {
    const hfEndpoints = [
        'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo',
        'https://router.huggingface.co/hf-inference/models/openai/whisper-small'
    ];

    for (const endpoint of hfEndpoints) {
        try {
            console.log(`🎙️ [STT Nube] Transcribiendo audio con Hugging Face (${endpoint.split('/').pop()})...`);
            const res = await axios.post(endpoint, audioBuffer, {
                headers: { 'Content-Type': 'audio/ogg' },
                timeout: 20000
            });
            const text = res.data?.text;
            if (text && text.trim().length > 0) {
                console.log(`🎙️ [STT Nube] Transcripción exitosa (Whisper HF): "${text.trim()}"`);
                return text.trim();
            }
        } catch (e) {}
    }
    return null;
}

/**
 * Procesador principal de notas de voz
 */
async function processVoice(media) {
    const audioBuffer = Buffer.from(media.data, 'base64');

    // 1. Google Gemini Multimodal
    const geminiRes = await transcribeViaGemini(media.data);
    if (geminiRes) return geminiRes;

    // 2. Hugging Face Whisper Router
    const hfRes = await transcribeViaHuggingFace(audioBuffer);
    if (hfRes) return hfRes;

    console.warn("⚠️ No se pudo transcribir el audio con las APIs configuradas.");
    return null;
}

module.exports = { processVoice };
