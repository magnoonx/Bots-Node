const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function processVoice(media) {
    const audioBuffer = Buffer.from(media.data, 'base64');

    // 1. Intentar transcripción gratuita con Hugging Face Router (Whisper Large V3 Turbo)
    const hfEndpoints = [
        'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo',
        'https://router.huggingface.co/hf-inference/models/openai/whisper-small',
        'https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo'
    ];

    for (const endpoint of hfEndpoints) {
        try {
            console.log(`🎙️ Transcribiendo audio con Hugging Face (${endpoint.split('/').pop()})...`);
            const res = await axios.post(
                endpoint,
                audioBuffer,
                {
                    headers: { 'Content-Type': 'audio/ogg' },
                    timeout: 15000
                }
            );
            const text = res.data?.text;
            if (text && text.trim().length > 0) {
                console.log(`🎙️ Transcripción exitosa (Whisper): "${text.trim()}"`);
                return text.trim();
            }
        } catch (e) {
            console.warn(`⚠️ Hugging Face (${endpoint.split('/').pop()}) no respondió:`, e.response?.data?.error || e.message);
        }
    }

    // 2. Intentar transcripción con Google Gemini AI directo (modelos 1.5 y 2.0)
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
        const geminiModelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];
        
        // Tratar de descubrir modelos dinámicos excluyendo gemini-2.5
        try {
            const listRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
            const models = listRes.data?.models || [];
            const valid = models
                .filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('flash') && !m.name.includes('2.5'))
                .map(m => m.name.replace('models/', ''));
            if (valid.length > 0) {
                geminiModelsToTry.unshift(...valid);
            }
        } catch (e) {}

        const uniqueModels = [...new Set(geminiModelsToTry)];

        for (const modelSlug of uniqueModels) {
            try {
                console.log(`🎙️ Transcribiendo audio con Google Gemini (${modelSlug})...`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelSlug}:generateContent?key=${geminiKey}`;
                const body = {
                    contents: [
                        {
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: 'audio/ogg',
                                        data: media.data
                                    }
                                },
                                { text: 'Transcribe este mensaje de voz a texto en español exactamente. Devuelve ÚNICAMENTE la transcripción.' }
                            ]
                        }
                    ]
                };

                const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
                const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text && text.trim().length > 0) {
                    console.log(`🎙️ Transcripción exitosa (Gemini): "${text.trim()}"`);
                    return text.trim();
                }
            } catch (e) {
                console.error(`❌ Error Audio Gemini (${modelSlug}):`, e.response?.data?.error?.message || e.message);
            }
        }
    }

    console.warn("⚠️ No se pudo transcribir el audio con los proveedores configurados.");
    return null;
}

module.exports = { processVoice };