const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sessionManager = require('./sessionManager');

// Variables de estado para la instancia en memoria de node-llama-cpp
let llamaInstance = null;
let loadedModel = null;
let modelContext = null;

// Cola secuencial para evitar condiciones de carrera en inferencia local
let inferenceQueue = Promise.resolve();

/**
 * Busca y resuelve la ruta del archivo .gguf en la carpeta models/
 */
function getGGUFModelPath() {
    const modelsDir = path.join(__dirname, '..', '..', 'models');
    
    // 1. Si está definido explícitamente en .env
    if (process.env.LOCAL_GGUF_PATH) {
        const customPath = path.isAbsolute(process.env.LOCAL_GGUF_PATH)
            ? process.env.LOCAL_GGUF_PATH
            : path.join(__dirname, '..', '..', process.env.LOCAL_GGUF_PATH);
        if (fs.existsSync(customPath)) return customPath;
    }

    // 2. Buscar cualquier archivo .gguf dentro de models/
    if (fs.existsSync(modelsDir)) {
        const files = fs.readdirSync(modelsDir);
        const ggufFile = files.find(f => f.toLowerCase().endsWith('.gguf'));
        if (ggufFile) return path.join(modelsDir, ggufFile);
    }

    return null;
}

/**
 * Inicializa node-llama-cpp con gestión de memoria y secuencias
 */
async function getOrInitLlama() {
    if (loadedModel && modelContext && !modelContext.disposed) {
        return { llama: llamaInstance, model: loadedModel, context: modelContext };
    }

    const modelPath = getGGUFModelPath();
    if (!modelPath) {
        throw new Error("No se encontró ningún archivo .gguf en la carpeta 'models/'.");
    }

    const { getLlama } = await import('node-llama-cpp');
    const userGpuSetting = process.env.LOCAL_GPU === 'false' ? false : (process.env.LOCAL_GPU || 'auto');
    const contextSize = parseInt(process.env.LOCAL_CONTEXT_SIZE, 10) || 2048;

    try {
        console.log(`🧠 [IA Portable] Cargando modelo: ${path.basename(modelPath)}`);
        console.log(`⚙️ [IA Portable] Configuración: GPU=${userGpuSetting}, Contexto=${contextSize} tokens, Secuencias=2`);
        
        const llama = await getLlama({ gpu: userGpuSetting });
        const model = await llama.loadModel({ modelPath });
        const context = await model.createContext({
            contextSize: contextSize,
            sequences: 2
        });

        llamaInstance = llama;
        loadedModel = model;
        modelContext = context;

        console.log(`🚀 [IA Portable] Modelo listo y operativo.`);
        return { llama, model, context };
    } catch (err) {
        if (userGpuSetting !== false) {
            console.warn(`⚠️ [IA Portable] VRAM insuficiente en GPU (${err.message}). Activando modo CPU seguro...`);
            try {
                const llama = await getLlama({ gpu: false });
                const model = await llama.loadModel({ modelPath, gpuLayers: 0 });
                const context = await model.createContext({
                    contextSize: 2048,
                    sequences: 2
                });

                llamaInstance = llama;
                loadedModel = model;
                modelContext = context;

                console.log(`✅ [IA Portable] Modelo cargado con éxito en modo CPU.`);
                return { llama, model, context };
            } catch (cpuErr) {
                console.error(`❌ [IA Portable] Error crítico en CPU:`, cpuErr.message);
                throw cpuErr;
            }
        }
        throw err;
    }
}

/**
 * Inferencia con motor en memoria gestionando secuencias, historial persistente y liberación de recursos
 */
async function getInProcessAIResponse(prompt, systemInstruction, jid = null, userName = null) {
    return new Promise((resolve) => {
        inferenceQueue = inferenceQueue.then(async () => {
            let sequence = null;
            try {
                const { LlamaChatSession } = await import('node-llama-cpp');
                const { model, context } = await getOrInitLlama();

                // Si por alguna razón no quedan secuencias libres, recrear el contexto
                if (modelContext.sequencesLeft === 0) {
                    console.log("🔄 [IA Portable] Recreando contexto de secuencias...");
                    try { await modelContext.dispose(); } catch(e) {}
                    const contextSize = parseInt(process.env.LOCAL_CONTEXT_SIZE, 10) || 2048;
                    modelContext = await model.createContext({
                        contextSize: contextSize,
                        sequences: 2
                    });
                }

                sequence = modelContext.getSequence();

                const session = new LlamaChatSession({
                    contextSequence: sequence,
                    systemPrompt: systemInstruction
                });

                // Cargar historial previo de la conversación si existe para este usuario
                if (jid) {
                    const savedHistory = sessionManager.loadChatHistory(jid);
                    if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
                        try {
                            session.setChatHistory(savedHistory);
                            console.log(`📖 [Memoria] Historial restaurado (${savedHistory.length} elementos) para ${jid}`);
                        } catch (histErr) {
                            console.warn(`⚠️ [Memoria] Error restaurando historial previo: ${histErr.message}`);
                        }
                    }
                }

                console.log(`🤖 [IA Portable] Generando respuesta local...`);
                const response = await session.prompt(prompt, {
                    maxTokens: 1024
                });

                if (response && response.trim().length > 0) {
                    // Guardar historial actualizado en disco
                    if (jid) {
                        try {
                            const updatedHistory = session.getChatHistory();
                            sessionManager.saveChatHistory(jid, updatedHistory, { userName });
                        } catch (saveErr) {
                            console.warn(`⚠️ [Memoria] Error guardando historial: ${saveErr.message}`);
                        }
                    }
                    console.log(`✅ [IA Portable] Respuesta generada exitosamente.`);
                    resolve(response.trim());
                    return;
                }
                resolve(null);
            } catch (err) {
                console.error(`⚠️ [IA Portable Error]:`, err.message);
                resolve(null);
            } finally {
                // Liberar la secuencia inmediatamente para que esté disponible para el siguiente mensaje
                if (sequence && !sequence.disposed) {
                    try {
                        sequence.dispose();
                    } catch (e) {
                        console.warn("⚠️ [IA Portable] Error liberando secuencia:", e.message);
                    }
                }
            }
        });
    });
}

/**
 * Fallback opcional si el usuario tuviera un endpoint local HTTP
 */
async function getHttpLocalAIResponse(prompt, systemInstruction) {
    const rawUrl = process.env.LOCAL_LLM_URL;
    if (!rawUrl) return null;

    const baseUrl = rawUrl.replace(/\/+$/, '');
    const model = process.env.LOCAL_LLM_MODEL || 'llama3.2:3b';

    const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
    ];

    try {
        const v1Url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
        const res = await axios.post(v1Url, {
            model: model,
            messages: messages,
            max_tokens: 1024
        }, { timeout: 15000 });

        const text = res.data?.choices?.[0]?.message?.content;
        if (text && text.trim().length > 0) return text.trim();
    } catch (e) {}

    return null;
}

/**
 * Fallback opcional a Google Gemini si hay clave configurada
 */
async function getGeminiAIResponse(prompt, systemInstruction) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) return null;

    let models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const body = {
                contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n[Mensaje del usuario]:\n${prompt}` }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            };
            const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
        } catch (err) {}
    }
    return null;
}

/**
 * Generador principal de respuestas conversacionales
 */
async function getAIResponse(prompt, datosNegocio, userName = null, esPrimerContacto = false, jid = null) {
    const userFinal = userName || datosNegocio?.userName || "Invitado";
    const nombre = "Bot de David";

    const reglaSaludo = esPrimerContacto
        ? `Si el mensaje es un saludo inicial, saluda de forma muy breve y seca (ejemplo: "Hola ${userFinal}. Dime en qué te ayudo.").`
        : `NO saludes. La conversación ya está en curso: ve DIRECTAMENTE al grano.`;

    const systemInstruction = `Eres "${nombre}", un asistente de IA práctico, directo y conciso.
Estás en un entorno de pruebas y respondes a cualquier consulta sin rodeos.

ESTILO ESTRICTO:
- CERO RELLENO: Tienes estrictamente PROHIBIDO abrir tus respuestas con cortesías o frases de relleno como:
  * "¡Hola [Nombre]! Me alegra poder ayudarte..."
  * "¡Claro que sí! Con mucho gusto..."
  * "¡Excelente pregunta!..."
  * "Es un placer atenderte..."
- DIRECTO AL GRANO: Comienza tu respuesta directamente con los hechos, la solución o la respuesta a la pregunta, sin preámbulos.
- ${reglaSaludo}
- No repitas el nombre del usuario a cada momento.

REGLAS DE INTERACCIÓN:
1) Responde a cualquier tema libremente (programación, ciencia, redacción, cálculos, soporte, etc.) de forma precisa y sintética.
2) Comprobantes bancarios: extrae únicamente Banco, Monto y Referencia sin rodeos.
3) Consultas sobre documentos/PDFs: entrega la información puntual solicitada.
4) No menciones módulos ni librerías internas.`;

    // 1. Inferencia directa en memoria (node-llama-cpp) con soporte de sesión persistente
    const inProcessRes = await getInProcessAIResponse(prompt, systemInstruction, jid, userFinal);
    if (inProcessRes) return inProcessRes;

    // 2. Endpoint HTTP local alternativo
    const httpRes = await getHttpLocalAIResponse(prompt, systemInstruction);
    if (httpRes) return httpRes;

    // 3. Fallback opcional a la nube si las claves están presentes
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
        const geminiRes = await getGeminiAIResponse(prompt, systemInstruction);
        if (geminiRes) return geminiRes;
    }

    const ggufFound = getGGUFModelPath();
    if (!ggufFound) {
        return "⚠️ *Aviso de Configuración:* No se encontró el archivo del modelo en la carpeta `models/`.\n\nDescárgalo ejecutando:\n`node descargar_modelo.js`";
    }

    return "⚠️ *Aviso:* El modelo local no pudo procesar la solicitud. Revisa la consola para más detalles.";
}

const pdfHandler = require('./pdfHandler');

/**
 * Consulta RAG sobre documentos PDF indexados localmente
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
    getGGUFModelPath,
    sessionManager
};
