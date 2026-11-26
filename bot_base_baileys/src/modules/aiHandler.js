const fs = require('fs');
const path = require('path');
const axios = require('axios');

function discoverModuleCapabilities() {
    try {
        const modsDir = path.join(__dirname);
        const files = fs.readdirSync(modsDir).filter(f => f.endsWith('.js'));
        const caps = [];
        for (const file of files) {
            const full = path.join(modsDir, file);
            const content = fs.readFileSync(full, 'utf8');
            const m = content.match(/module\.exports\s*=\s*\{([\s\S]*?)\}/m);
            const exportsList = [];
            if (m && m[1]) {
                const parts = m[1].split(',').map(s => s.replace(/\/\*.*?\*\//g,'').trim()).filter(Boolean);
                for (const p of parts) {
                    const name = p.split(':')[0].trim();
                    if (name) exportsList.push(name);
                }
            } else {
                const matches = [...content.matchAll(/module\.exports\.([a-zA-Z0-9_]+)\s*=/g)];
                for (const mm of matches) exportsList.push(mm[1]);
            }
            caps.push({ module: file, exports: exportsList });
        }
        return caps;
    } catch (e) {
        return [];
    }
}

const _capabilities = discoverModuleCapabilities();

async function getGeminiAIResponse(prompt, systemInstruction) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) return null;

    let models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    try {
        const listRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
        const available = (listRes.data?.models || [])
            .filter(m => m.supportedGenerationMethods?.includes('generateContent') && !m.name.includes('2.5'))
            .map(m => m.name.replace('models/', ''));
        if (available.length > 0) models = available;
    } catch(e) {}

    for (const model of models) {
        try {
            console.log(`🤖 Consultando a Google Gemini AI (${model})...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const body = {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `${systemInstruction}\n\n[Mensaje del usuario]:\n${prompt}` }]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024
                }
            };

            const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
        } catch (err) {
            console.error(`❌ Error en Gemini (${model}):`, err.response?.data?.error?.message || err.message);
        }
    }
    return null;
}

async function getOpenRouterAIResponse(prompt, systemInstruction) {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) return null;

    // Slugs estándar y vigentes de OpenRouter
    const models = [
        'openrouter/auto',
        'deepseek/deepseek-r1',
        'meta-llama/llama-3.1-8b-instruct',
        'qwen/qwen-2.5-72b-instruct',
        'google/gemini-flash-1.5'
    ];

    for (const model of models) {
        try {
            console.log(`🤖 Consultando a OpenRouter (${model})...`);
            const url = 'https://openrouter.ai/api/v1/chat/completions';
            const body = {
                model: model,
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ]
            };
            const res = await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'HTTP-Referer': 'https://eddia.com.ve',
                    'X-Title': 'CoreBot EDDIA',
                    'Content-Type': 'application/json'
                }
            });
            const text = res.data?.choices?.[0]?.message?.content;
            if (text) return text;
        } catch (err) {
            console.error(`❌ Error en OpenRouter (${model}):`, err.response?.data?.error?.message || err.message);
        }
    }
    return null;
}

async function getAIResponse(prompt, datosNegocio) {
    const nombre = datosNegocio?.nombre || "EDDIA Consultores";
    const rubro = datosNegocio?.rubro || "Creación de Bots, Desarrollo de Software y Sistemas embebidos.";
    const detalles = datosNegocio?.detalles || "Expertos en Creación de Bots, Desarrollo de Software Web/Móvil, Sistemas embebidos e IA industrial.";

    const systemInstruction = `Eres el asistente virtual experto de ${nombre}. 
Tu objetivo es brindar respuestas ejecutivas, profesionales y directas sobre investigación académica y soporte técnico.

REGLAS DE INTERACCIÓN:
1) NO menciones nombres de módulos internos al usuario. El proceso técnico debe ser invisible.
2) Si el usuario envía un audio o documento, asume que el sistema ya lo procesó y responde directamente.
3) Usa un tono humano, amable y profesional. Usa emojis de forma moderada.
4) Si respondes en base a documentos, cita las fuentes de forma elegante [1].
5) Si la pregunta es sobre ${nombre}, usa esta info: ${rubro}. ${detalles}.

Información de contacto: ${datosNegocio?.contacto?.whatsapp_soporte || '+584128876344'}`;

    // 1. Intentar con OpenRouter si la clave está disponible
    if (process.env.OPENROUTER_API_KEY) {
        const openRouterRes = await getOpenRouterAIResponse(prompt, systemInstruction);
        if (openRouterRes) return openRouterRes;
    }

    // 2. Intentar con Google Gemini AI si la clave está disponible
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
        const geminiRes = await getGeminiAIResponse(prompt, systemInstruction);
        if (geminiRes) return geminiRes;
    }

    return "⚠️ Configuración requerida: No se ha configurado ninguna API Key válida en el archivo .env (se recomienda OPENROUTER_API_KEY o GEMINI_API_KEY).";
}

module.exports = { getAIResponse };

// --- SECCIÓN PDF CORREGIDA ---
const pdfHandler = require('./pdfHandler');

async function getAIResponseFromPdfs(dir, question, datosNegocio = {}, opts = {}) {
    const useOCR = opts.useOCR !== undefined ? !!opts.useOCR : true;
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

    // 1. Asegurar la indexación
    await pdfHandler.buildIndex(dir, { useOCR, onProgress });

    // 2. Obtener fragmentos relevantes
    const topK = opts.topK || 5;
    const queryRes = pdfHandler.query(question, { topK });

    let contextText = '';
    const numberedSources = [];

    // 3. Validar existencia de resultados y evitar 'undefined' al separar texto
    if (queryRes.sources && queryRes.sources.length > 0 && queryRes.answer) {
        contextText = '--- COMIENZO DEL CONTEXTO ACADÉMICO ---\n\n';
        
        // Separamos el texto concatenado de pdfHandler por los separadores de párrafos
        const snippets = queryRes.answer.split('\n\n');

        queryRes.sources.forEach((s, i) => {
            const content = (snippets[i] || '').trim();
            if (content) {
                contextText += `FUENTE [${i + 1}]: Archivo "${s.file}" (Bloque ${s.chunk})\nCONTENIDO: ${content}\n\n`;
                numberedSources.push({ idx: i + 1, file: s.file, path: s.path, chunk: s.chunk, snippet: content });
            }
        });
        
        contextText += '--- FIN DEL CONTEXTO ---';
    } else {
        // Fallback si no hay coincidencias de TF-IDF
        return { 
            answer: "Lo siento, no encontré información relevante en los documentos cargados para responder a esa pregunta.", 
            sources: [] 
        };
    }

    // 4. Prompt estilo RAG para investigación académica
    const prompt = `Actúa como un experto en investigación académica. 
Tu tarea es responder a la PREGUNTA del usuario utilizando ÚNICAMENTE los fragmentos de los documentos proporcionados en el CONTEXTO arriba.

REGLAS CRÍTICAS:
1. Si la respuesta está en el contexto, redáctala de forma profesional y cita siempre al final de cada párrafo o idea la fuente usando [1], [2], etc.
2. Si el contexto menciona términos técnicos, explícalos basándote solo en lo que dice el texto.
3. SI LA INFORMACIÓN NO ESTÁ EN EL CONTEXTO, responde exactamente: "Lo siento, la información solicitada no se encuentra en los documentos cargados."
4. No inventes datos que no estén explícitamente escritos en los fragmentos.

CONTEXTO:
${contextText}

PREGUNTA: ${question}

RESPUESTA ACADÉMICA:`;

    // 5. Retornar respuesta estructurada
    const aiAnswer = await getAIResponse(prompt, datosNegocio);
    return { answer: aiAnswer, sources: numberedSources };
}

module.exports.getAIResponseFromPdfs = getAIResponseFromPdfs;