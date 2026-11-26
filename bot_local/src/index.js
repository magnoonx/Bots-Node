const fs = require('fs');
const path = require('path');

// Carga nativa de variables de entorno desde el archivo .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
                const key = trimmed.slice(0, eqIdx).trim();
                const val = trimmed.slice(eqIdx + 1).trim();
                if (key) process.env[key] = val;
            }
        }
    });
}

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// Módulos propios
const aiHandler = require('./modules/aiHandler');
const calendar = require('./modules/googleCalendar');
const audioHandler = require('./modules/audioHandler');
const visionHandler = require('./modules/visionHandler');
const ttsHandler = require('./modules/ttsHandler'); // Importado correctamente

const CALENDAR_ID = 'denrique.duarte@gmail.com';
const configNegocio = {
    nombre: "Asistente de David",
    rubro: "Asistente personal del profesor universitario David",
    detalles: "Atención automática de consultas académicas, recados, documentos y mensajes personales en nombre del profesor David.",
    contacto: {}
};

// --- GESTIÓN DE SESIONES Y TIMERS ---
const sesionesActivas = {};
const tempTimers = {};
const TIEMPO_EXPIRACION = 60 * 60 * 1000;

async function startBot() {
    try {
        console.log('🔄 Iniciando Bot de David...');

        // Limpieza automática de modelos pesados para liberar espacio en disco
        const modelsDir = path.join(__dirname, '..', 'models');
        if (fs.existsSync(modelsDir)) {
            try {
                fs.readdirSync(modelsDir).forEach(file => {
                    if (file.toLowerCase().endsWith('.gguf') || file.toLowerCase().endsWith('.bin')) {
                        fs.unlinkSync(path.join(modelsDir, file));
                        console.log(`🗑️ Modelo local eliminado para liberar espacio: ${file}`);
                    }
                });
            } catch (e) {}
        }

        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        let version;
        try {
            const latest = await fetchLatestBaileysVersion();
            version = latest.version;
            console.log(`📌 Versión de Baileys detectada: ${version.join('.')}`);
        } catch (vErr) {
            console.warn('⚠️ No se pudo consultar la última versión de Baileys desde GitHub. Usando versión por defecto.');
            version = [6, 5, 0];
        }

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            shouldIgnoreJid: (jid) => jid.includes('@broadcast') || jid.includes('@g.us'),
            getMessage: async (key) => { return { conversation: '' } }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                console.log("✅ Escanea el código QR:");
                qrcode.generate(qr, { small: true });
            }
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Conexión cerrada. Código de estado: ${statusCode}`);
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log('🔄 Reintentando conexión...');
                    startBot();
                } else {
                    console.log('❌ Sesión cerrada por el usuario. Elimina la carpeta "auth_info" y vuelve a escanear el QR.');
                }
            } else if (connection === 'open') {
                console.log('🚀 Bot de David Operativo (Modo API en la Nube)');
                console.log('🤖 Proveedores IA: Google Gemini AI / OpenRouter (Memoria persistente activa)');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            const m = messages[0];
            if (!m || !m.message) return;

            const jid = m.key.remoteJid;
            if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') return;

            // Permitir auto-mensajes para pruebas cuando se envía un mensaje a uno mismo
            const botNumber = sock.user?.id ? sock.user.id.split(':')[0] : '';
            const isSelfMessage = m.key.fromMe && botNumber && jid.includes(botNumber);

            if (m.key.fromMe && !isSelfMessage) return;

            // Desempaquetar contenido de mensajes efímeros o de vista única
            const msgContent = m.message?.ephemeralMessage?.message || 
                               m.message?.viewOnceMessage?.message || 
                               m.message?.viewOnceMessageV2?.message || 
                               m.message;

            const body = msgContent?.conversation || 
                         msgContent?.extendedTextMessage?.text || 
                         msgContent?.imageMessage?.caption || 
                         msgContent?.videoMessage?.caption || 
                         "";

            const nombreFinal = m.pushName || "Invitado";
            console.log(`📩 [Mensaje recibido] De: ${nombreFinal} (${jid}) | Texto: "${body}"`);

            const bodyLow = body.toLowerCase().trim();
            const uploadDir = path.join(__dirname, '..', 'data', 'pdfs', `UPLOAD_${jid.replace(/[^a-zA-Z0-9]/g, '_')}`);

            // --- 1. LÓGICA DE RESPUESTA AL MENÚ ---
            if (fs.existsSync(uploadDir) && fs.readdirSync(uploadDir).length > 0) {
                if (body === '1') {
                    await sock.sendMessage(jid, { text: '⏳ Procesando e indexando documentos... un momento.' });
                    const userQuestion = 'Resume el contenido de forma detallada y extrae los puntos clave en español.';
                    const res = await aiHandler.getAIResponseFromPdfs(uploadDir, userQuestion, configNegocio, { topK: 5 });

                    if (res.answer) {
                        await sock.sendMessage(jid, { text: res.answer });
                        const menuCierre = `📌 *Opciones de sesión:*\n\nEscribe *3* para Subir más archivos.\nEscribe *4* para Finalizar y borrar todo.`;
                        await sock.sendMessage(jid, { text: menuCierre });
                    }
                    return;
                }

                if (body === '2') {
                    return await sock.sendMessage(jid, { text: 'Entendido. Envía los siguientes archivos PDF y los iré acumulando.' });
                }

                if (body === '3' || body === '4') {
                    if (fs.existsSync(uploadDir)) {
                        fs.readdirSync(uploadDir).forEach(f => fs.unlinkSync(path.join(uploadDir, f)));
                    }
                    const pdfHandler = require('./modules/pdfHandler');
                    pdfHandler.clearCache(uploadDir);
                    const msg = body === '3' ? '🗑️ Carpeta vaciada. Puedes empezar a subir archivos nuevos.' : '🧹 Caché limpia y proceso finalizado.';
                    return await sock.sendMessage(jid, { text: msg });
                }
            }

async function downloadMediaWithRetry(message, type, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const stream = await downloadContentFromMessage(message, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            return buffer;
        } catch (err) {
            console.warn(`⚠️ Intento ${attempt}/${retries} de descarga multimedia (${type}) falló: ${err.message}`);
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 1500 * attempt));
        }
    }
}

            // --- 2. TRATAMIENTO DE IMÁGENES ---
            const imageMsg = msgContent.imageMessage;
            if (imageMsg) {
                try {
                    console.log("📷 Imagen recibida, procesando...");
                    const buffer = await downloadMediaWithRetry(imageMsg, 'image');
                    const textoExtraido = await visionHandler.extractTextFromImage(buffer);
                    if (textoExtraido) {
                        const promptVision = `(El usuario ${nombreFinal} envió un comprobante). Analiza: Banco, Monto y Referencia. Texto: ${textoExtraido}`;
                        const resIA = await aiHandler.getAIResponse(promptVision, configNegocio, nombreFinal);
                        await sock.sendMessage(jid, { text: `🔍 *Análisis de comprobante:* \n\n${resIA}` });
                    }
                } catch (e) { console.log("❌ Error imagen", e); }
                return;
            }

            // --- 3. TRATAMIENTO DE AUDIO ---
            const audioMsg = msgContent.audioMessage;
            if (audioMsg) {
                try {
                    console.log("🎤 Audio/Nota de voz recibida, descargando...");
                    const buffer = await downloadMediaWithRetry(audioMsg, 'audio');
                    const textoEscuchado = await audioHandler.processVoice({ data: buffer.toString('base64') });
                    if (textoEscuchado) {
                        let respuestaFinal = "";
                        if (fs.existsSync(uploadDir) && fs.readdirSync(uploadDir).length > 0) {
                            const resPDF = await aiHandler.getAIResponseFromPdfs(uploadDir, textoEscuchado, configNegocio, { userName: nombreFinal });
                            if (resPDF.answer && !resPDF.answer.includes("no hay información suficiente")) {
                                respuestaFinal = `🎙️ *He escuchado tu duda:* \n\n${resPDF.answer}`;
                            }
                        }
                        if (!respuestaFinal) {
                            respuestaFinal = await aiHandler.getAIResponse(textoEscuchado, configNegocio, nombreFinal, false, jid);
                        }
                        await sock.sendMessage(jid, { text: respuestaFinal });
                    } else {
                        await sock.sendMessage(jid, { text: "🎙️ He recibido tu nota de voz, pero no pude transcribirla en este momento. Por favor, envíame tu consulta por escrito." });
                    }
                } catch (e) { console.log("❌ Error procesando audio:", e); }
                return;
            }

            // --- 4. MANEJO DE DOCUMENTOS (PDF y WORD) ---
            const docMsg = msgContent.documentMessage;
            if (docMsg) {
                const doc = docMsg;
                const filename = (doc.fileName || `file_${Date.now()}`).replace(/\s+/g, '_');
                const isWord = doc.mimetype.includes('officedocument.wordprocessingml.document') || filename.toLowerCase().endsWith('.docx');

                // NUEVA LÓGICA: Si es Word, llamar al ttsHandler
                if (isWord) {
                    try {
                        const buffer = await downloadMediaWithRetry(doc, 'document');

                        const media = {
                            data: buffer.toString('base64'),
                            mimetype: doc.mimetype,
                            filename: filename
                        };

                        await ttsHandler(sock, m, media);
                    } catch (e) {
                        console.error("❌ Error procesando Word para TTS", e);
                    }
                    return;
                }

                // Lógica original para PDFs
                if (!filename.toLowerCase().endsWith('.pdf')) return;

                fs.mkdirSync(uploadDir, { recursive: true });
                const buffer = await downloadMediaWithRetry(doc, 'document');
                fs.writeFileSync(path.join(uploadDir, filename), buffer);

                if (tempTimers[jid]) clearTimeout(tempTimers[jid]);
                tempTimers[jid] = setTimeout(async () => {
                    const archivos = fs.readdirSync(uploadDir);
                    const menuCarga = `✅ *${archivos.length} Archivo(s) recibido(s).*\n\n` +
                        `¿Qué deseas hacer ahora?\n\n` +
                        `1️⃣ *Procesar:* Resumir y responder\n` +
                        `2️⃣ *Subir:* Enviar más archivos\n` +
                        `3️⃣ *Reiniciar:* Empezar de nuevo\n` +
                        `4️⃣ *Finalizar:* Limpiar y salir`;
                    await sock.sendMessage(jid, { text: menuCarga });
                    delete tempTimers[jid];
                }, 3000);
                return;
            }

            // --- 5. MENÚS RÁPIDOS Y OTROS ---
            if (bodyLow === '/reset' || bodyLow === '/limpiar' || bodyLow === '/reiniciar' || bodyLow === 'reset') {
                aiHandler.sessionManager.clearChatHistory(jid);
                delete sesionesActivas[jid];
                return await sock.sendMessage(jid, { text: '🧹 *Memoria de conversación reiniciada.* ¿De qué deseas hablar ahora?' });
            }
            if (bodyLow === '1' || bodyLow === 'servicios' || bodyLow === 'ayuda') {
                return await sock.sendMessage(jid, { text: `¡Hola! Soy el *${configNegocio.nombre}*, su asistente personal por WhatsApp. Puedo ayudarte con dudas académicas, recibir recados para el profesor, revisar documentos PDF o atender tus consultas mientras él se desocupa.\n\nSi deseas reiniciar nuestra conversación en cualquier momento, escribe */reset*.` });
            }
            if (bodyLow === '3' || bodyLow === 'agenda') {
                const agenda = await calendar.getDailyEvents(CALENDAR_ID);
                return await sock.sendMessage(jid, { text: `📅 *Agenda de hoy:* \n\n${agenda}` });
            }

            // --- 6. RESPUESTA HÍBRIDA FINAL (TEXTO) ---
            try {
                const ahora = Date.now();
                const esPrimerContacto = !sesionesActivas[jid] || (ahora - sesionesActivas[jid]) > TIEMPO_EXPIRACION;
                sesionesActivas[jid] = ahora;

                let respuestaFinal = "";
                if (fs.existsSync(uploadDir) && fs.readdirSync(uploadDir).length > 0) {
                    const resPDF = await aiHandler.getAIResponseFromPdfs(uploadDir, body, configNegocio, { userName: nombreFinal, esPrimerContacto, jid });
                    if (resPDF.answer && !resPDF.answer.includes("no hay información suficiente")) {
                        respuestaFinal = resPDF.answer;
                    }
                }

                if (!respuestaFinal) {
                    respuestaFinal = await aiHandler.getAIResponse(body, configNegocio, nombreFinal, esPrimerContacto, jid);
                }

                await sock.sendMessage(jid, { text: respuestaFinal });
            } catch (error) {
                if (error?.output?.statusCode === 428 || error?.message?.includes('Connection Closed')) {
                    console.warn("⚠️ La conexión con WhatsApp se desconectó temporalmente al intentar enviar la respuesta (Código 428). El bot reconectará automáticamente.");
                } else {
                    console.error("❌ Error enviando mensaje:", error);
                }
            }
        });
    } catch (error) {
        console.error('❌ Error crítico durante el inicio de startBot:', error);
    }
}

startBot().catch(err => console.error("❌ Error no capturado al iniciar el bot:", err));