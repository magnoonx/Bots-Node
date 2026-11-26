const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { spawn } = require('child_process');

/**
 * Intenta transcribir audio usando un endpoint HTTP local de Whisper
 * (Compatible con faster-whisper-server, whisper.cpp, LocalAI o Ollama STT)
 */
async function transcribeViaLocalHttp(audioBuffer) {
    const rawUrl = process.env.LOCAL_STT_URL || 'http://127.0.0.1:8000/v1/audio/transcriptions';
    try {
        console.log(`🎙️ [STT Local] Intentando transcripción vía endpoint local: ${rawUrl}...`);
        
        // Crear FormData en Node.js o buffer directo
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
        form.append('model', process.env.LOCAL_STT_MODEL || 'whisper-1');
        form.append('language', 'es');

        const res = await axios.post(rawUrl, form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        const text = res.data?.text;
        if (text && text.trim().length > 0) {
            console.log(`🎙️ [STT Local] Transcripción exitosa (HTTP Local): "${text.trim()}"`);
            return text.trim();
        }
    } catch (err) {
        console.warn(`⚠️ [STT Local] Endpoint HTTP local (${rawUrl}) no respondió: ${err.message}`);
    }
    return null;
}

/**
 * Intenta transcribir audio usando el script Python local (faster-whisper o whisper)
 */
async function transcribeViaLocalPython(audioBuffer) {
    return new Promise((resolve) => {
        const rootDir = path.join(__dirname, '..', '..');
        const isWindows = os.platform() === 'win32';
        const rutaPC = path.join(rootDir, '.gTTS', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python');
        const rutaVPS = path.join(rootDir, '.gTTS', 'bin', 'python');
        const pythonPath = fs.existsSync(rutaVPS) ? rutaVPS : (fs.existsSync(rutaPC) ? rutaPC : 'python');

        const scriptPath = path.join(__dirname, 'transcribe_local.py');
        const tempAudio = path.join(rootDir, `temp_stt_${Date.now()}.ogg`);

        try {
            fs.writeFileSync(tempAudio, audioBuffer);
            console.log(`🎙️ [STT Local] Ejecutando transcribe_local.py con ${pythonPath}...`);

            const proc = spawn(pythonPath, [scriptPath, tempAudio]);
            let output = '';
            let errorOutput = '';

            proc.stdout.on('data', (d) => { output += d.toString(); });
            proc.stderr.on('data', (d) => { errorOutput += d.toString(); });

            proc.on('close', (code) => {
                if (fs.existsSync(tempAudio)) {
                    try { fs.unlinkSync(tempAudio); } catch(e) {}
                }

                if (output.includes('TRANSCRIPCION:')) {
                    const texto = output.split('TRANSCRIPCION:')[1].trim();
                    if (texto) {
                        console.log(`🎙️ [STT Local] Transcripción exitosa (Whisper): "${texto}"`);
                        return resolve(texto);
                    }
                }

                if (output.includes('ERROR:')) {
                    console.warn(`⚠️ [STT Local]: ${output.trim()}`);
                }
                if (errorOutput && errorOutput.trim()) {
                    console.warn(`⚠️ [STT Local stderr]: ${errorOutput.trim()}`);
                }
                resolve(null);
            });

            proc.on('error', () => {
                if (fs.existsSync(tempAudio)) {
                    try { fs.unlinkSync(tempAudio); } catch(e) {}
                }
                resolve(null);
            });
        } catch (e) {
            if (fs.existsSync(tempAudio)) {
                try { fs.unlinkSync(tempAudio); } catch(e2) {}
            }
            resolve(null);
        }
    });
}

/**
 * Fallback a Hugging Face (si está conectado a internet)
 */
async function transcribeViaHuggingFace(audioBuffer) {
    const hfEndpoints = [
        'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo',
        'https://router.huggingface.co/hf-inference/models/openai/whisper-small'
    ];

    for (const endpoint of hfEndpoints) {
        try {
            console.log(`🎙️ [Fallback STT] Hugging Face (${endpoint.split('/').pop()})...`);
            const res = await axios.post(endpoint, audioBuffer, {
                headers: { 'Content-Type': 'audio/ogg' },
                timeout: 15000
            });
            const text = res.data?.text;
            if (text && text.trim().length > 0) return text.trim();
        } catch (e) {}
    }
    return null;
}

/**
 * Fallback a Google Gemini AI
 */
async function transcribeViaGemini(mediaBase64) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) return null;

    const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    for (const model of models) {
        try {
            console.log(`🎙️ [Fallback STT] Google Gemini (${model})...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const body = {
                contents: [{
                    parts: [
                        { inline_data: { mime_type: 'audio/ogg', data: mediaBase64 } },
                        { text: 'Transcribe este mensaje de voz a texto en español exactamente. Devuelve ÚNICAMENTE la transcripción.' }
                    ]
                }]
            };
            const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim().length > 0) return text.trim();
        } catch (e) {}
    }
    return null;
}

/**
 * Procesador principal de voz
 */
async function processVoice(media) {
    const audioBuffer = Buffer.from(media.data, 'base64');

    // 1. PRIORIDAD 1 LOCAL: Endpoint HTTP Local (Whisper Server / LocalAI)
    const localHttpRes = await transcribeViaLocalHttp(audioBuffer);
    if (localHttpRes) return localHttpRes;

    // 2. PRIORIDAD 2 LOCAL: Script Python Local (faster-whisper / whisper)
    const localPyRes = await transcribeViaLocalPython(audioBuffer);
    if (localPyRes) return localPyRes;

    // 3. Fallbacks remotos si no hay motor local activo y existen credenciales
    const hfRes = await transcribeViaHuggingFace(audioBuffer);
    if (hfRes) return hfRes;

    const geminiRes = await transcribeViaGemini(media.data);
    if (geminiRes) return geminiRes;

    console.warn("⚠️ No se pudo transcribir el audio: El servicio local de Whisper no está activo.");
    return null;
}

module.exports = { processVoice };
