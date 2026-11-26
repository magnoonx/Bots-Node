const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sessionManager = require('./sessionManager');

/**
 * Limpia la respuesta de la IA eliminando cadenas de pensamiento o análisis interno
 */
function cleanAIResponse(rawText) {
    if (!rawText) return rawText;
    let text = rawText;

    // Eliminar etiquetas de razonamiento <think>...</think> o <thought>...</thought>
    text = text.replace(/<(think|thought)>[\s\S]*?<\/\1>/gi, '').trim();
    text = text.replace(/<(think|thought)>[\s\S]*$/gi, '').trim();

    // Si el modelo devolvió un desglose de pensamiento con marcador de respuesta final
    const finalMarkerMatch = text.match(/(?:^|\n)\s*(?:\*\*?)?(?:Final Polish|Final Answer|Final Response|Respuesta final)\s*:?\s*(?:\*\*?)?\s*\n([\s\S]+)$/i);
    if (finalMarkerMatch && finalMarkerMatch[1].trim()) {
        text = finalMarkerMatch[1].trim();
        text = text.replace(/^["'“”]+|["'“”]+$/g, '').trim();
        return text;
    }

    // Si el modelo devolvió un desglose de pensamiento sin marcador final ("* User asks: ...", "* Persona: ...")
    if (/(?:^|\n)\s*[*\-•]?\s*(?:User says|User asks|System Persona|Persona|Thinking Process)\s*:/i.test(text)) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const candidate = lines[lines.length - 1];
        if (candidate) {
            text = candidate.replace(/^[\s*\->•"']+|[\s"']+$/g, '').trim();
        }
    }

    return text.trim();
}

/**
 * Consulta a Google Gemini AI API con soporte de historial de conversación
 */
async function getGeminiAIResponse(prompt, systemInstruction, history = []) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) return null;

    let models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const preferredOrder = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ];
    try {
        const listRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, { timeout: 10000 });
        const available = (listRes.data?.models || [])
            .filter(m =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                !m.name.includes('thinking') &&
                !m.name.includes('gemma')
            )
            .map(m => m.name.replace('models/', ''));
        if (available.length > 0) {
            available.sort((a, b) => {
                const idxA = preferredOrder.indexOf(a);
                const idxB = preferredOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
            });
            models = available;
        }
    } catch (e) {}

    const contents = [];
    if (Array.isArray(history)) {
        for (const item of history.slice(-12)) {
            if (item.content) {
                contents.push({
                    role: item.role === 'assistant' || item.role === 'model' ? 'model' : 'user',
                    parts: [{ text: item.content }]
                });
            }
        }
    }
    contents.push({
        role: 'user',
        parts: [{ text: prompt }]
    });

    for (const model of models) {
        try {
            console.log(`🤖 [API Gemini] Consultando modelo (${model})...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const body = {
                contents: contents,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024
                }
            };

            const res = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            const parts = res.data?.candidates?.[0]?.content?.parts || [];
            const text = parts
                .filter(p => !p.thought && typeof p.text === 'string')
                .map(p => p.text)
                .join('')
                .trim();
            if (text.length > 0) {
                console.log(`✅ [API Gemini] Respuesta recibida (${model})`);
                return cleanAIResponse(text);
            }
        } catch (err) {
            console.warn(`⚠️ [API Gemini] Error con modelo ${model}:`, err.response?.data?.error?.message || err.message);
        }
    }
    return null;
}

/**
 * Consulta a OpenRouter API con modelos de chat puros (sin modelos de razonamiento crudo)
 */
async function getOpenRouterAIResponse(prompt, systemInstruction, history = []) {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) return null;

    // Modelos de chat directos que NO filtran cadenas de razonamiento
    const models = [
        'meta-llama/llama-3.3-70b-instruct',
        'meta-llama/llama-3.1-8b-instruct',
        'google/gemini-flash-1.5',
        'qwen/qwen-2.5-72b-instruct'
    ];

    const messages = [
        { role: 'system', content: systemInstruction }
    ];

    if (Array.isArray(history)) {
        for (const item of history.slice(-12)) {
            if (item.content) {
                messages.push({
                    role: item.role === 'assistant' ? 'assistant' : 'user',
                    content: item.content
                });
            }
        }
    }
    messages.push({ role: 'user', content: prompt });

    for (const model of models) {
        try {
            console.log(`🤖 [API OpenRouter] Consultando modelo (${model})...`);
            const url = 'https://openrouter.ai/api/v1/chat/completions';
            const body = {
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024
            };

            const res = await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'HTTP-Referer': 'https://eddia.com.ve',
                    'X-Title': 'Bot de David',
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const text = res.data?.choices?.[0]?.message?.content;
            if (text && text.trim().length > 0) {
                console.log(`✅ [API OpenRouter] Respuesta recibida (${model})`);
                return cleanAIResponse(text);
            }
        } catch (err) {
            console.warn(`⚠️ [API OpenRouter] Error con modelo ${model}:`, err.response?.data?.error?.message || err.message);
        }
    }
    return null;
}

/**
 * Generador principal de respuestas conversacionales (Modo API con memoria persistente)
 */
async function getAIResponse(prompt, datosNegocio, userName = null, esPrimerContacto = false, jid = null) {
    const userFinal = userName || datosNegocio?.userName || "Invitado";
    const nombre = "Asistente de David";

    const reglaSaludo = esPrimerContacto
        ? `Es el primer mensaje de la conversación: saluda de forma cordial, natural y humana (por ejemplo: "¡Hola ${userFinal}! Soy el asistente personal del profesor David, ¿en qué te puedo ayudar?"). Si la persona ya hizo una pregunta concreta, saluda brevemente y respóndela de inmediato.`
        : `La conversación ya está en curso: NO vuelvas a saludar, responde con naturalidad dando continuidad a la charla.`;

    const systemInstruction = `Eres el asistente personal de WhatsApp de David, un profesor universitario.
Atiendes mensajes de estudiantes, colegas y contactos en su nombre cuando él no está disponible, manteniendo un trato humano, cercano, respetuoso y profesional.

FORMATO OBLIGATORIO:
- Responde ÚNICAMENTE con el mensaje final para WhatsApp.
- PROHIBIDO incluir notas internas, análisis de las instrucciones, viñetas de razonamiento ("User says...", "User asks...") o reflexiones previas.

ESTILO Y TONO HUMANO:
- Escribe como una persona real por WhatsApp: cálido, claro, empático y natural, con el criterio de un profesor universitario (educado pero cercano, sin rigidez robótica).
- Evita frases genéricas de IA ("Como modelo de lenguaje...", "Estoy aquí para asistirte en todo lo que necesites", "Con mucho gusto te ayudaré con esa solicitud"). Ve al punto con amabilidad.
- ${reglaSaludo}
- No repitas el nombre del usuario en cada mensaje.
- Usa respuestas bien medidas para WhatsApp: ni telegráficas/frías ni párrafos interminables.

REGLAS DE CONTENIDO:
1) Consultas académicas y generales (programación, ciencia, redacción, cálculos, orientación, etc.): explica con claridad, buen criterio docente y lenguaje natural.
2) Mensajes o recados personales para el profesor David (permisos, citas, notas específicas, entregas fuera de plazo u otros asuntos que requieran su decisión directa): responde con amabilidad, confirma que le transmitirás el mensaje y, si falta algún dato (como materia, sección o motivo), pídelo brevemente.
3) Comprobantes bancarios: extrae con claridad Banco, Monto y Referencia de forma amable.
4) Documentos y PDFs: responde de forma clara y puntual basándote en la información del documento.
5) No menciones módulos, código ni librerías internas.`;

    // Cargar historial de conversación persistente si existe
    let history = [];
    if (jid) {
        const saved = sessionManager.loadChatHistory(jid);
        if (Array.isArray(saved)) {
            history = saved;
            console.log(`📖 [Memoria] Historial cargado (${history.length} mensajes) para ${jid}`);
        }
    }

    let aiResponse = null;

    // 1. Prioridad: Google Gemini API
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
        aiResponse = await getGeminiAIResponse(prompt, systemInstruction, history);
    }

    // 2. Fallback: OpenRouter API
    if (!aiResponse && process.env.OPENROUTER_API_KEY) {
        aiResponse = await getOpenRouterAIResponse(prompt, systemInstruction, history);
    }

    if (aiResponse) {
        // Guardar la nueva interacción en el historial persistente
        if (jid) {
            history.push({ role: 'user', content: prompt });
            history.push({ role: 'assistant', content: aiResponse });
            // Conservar últimos 20 mensajes para optimizar
            if (history.length > 20) history = history.slice(-20);
            sessionManager.saveChatHistory(jid, history, { userName: userFinal });
        }
        return aiResponse;
    }

    return "⚠️ *Error de API:* No se pudo conectar con los proveedores de IA en la nube. Verifica tus claves GEMINI_API_KEY o OPENROUTER_API_KEY en el archivo .env.";
}

const pdfHandler = require('./pdfHandler');

/**
 * Consulta RAG sobre documentos PDF
 */
async function getAIResponseFromPdfs(dir, question, datosNegocio = {}, opts = {}) {
    const useOCR = opts.useOCR !== undefined ? !!opts.useOCR : true;
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

    await pdfHandler.buildIndex(dir, { useOCR, onProgress });

    const topK = opts.topK || 5;
    const queryRes = pdfHandler.query(question, { topK });

    let contextText = '';
    const numberedSources = [];

    if (queryRes.sources && queryRes.sources.length > 0 && queryRes.answer) {
        contextText = '--- COMIENZO DEL CONTEXTO ACADÉMICO ---\n\n';
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
        return { 
            answer: "Lo siento, no encontré información relevante en los documentos cargados para responder a esa pregunta.", 
            sources: [] 
        };
    }

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

    const aiAnswer = await getAIResponse(prompt, datosNegocio, opts.userName, !!opts.esPrimerContacto, opts.jid || null);
    return { answer: aiAnswer, sources: numberedSources };
}

module.exports = {
    getAIResponse,
    getAIResponseFromPdfs,
    cleanAIResponse,
    sessionManager
};
