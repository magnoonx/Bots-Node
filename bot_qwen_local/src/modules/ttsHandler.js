const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

async function ttsHandler(sock, m, media) {
    const jid = m.key.remoteJid;
    const isWindows = os.platform() === 'win32';
    
    // Raíz del bot (donde está el package.json)
    const rootDir = path.join(__dirname, '..', '..'); 

    // Definimos las dos rutas posibles
    const rutaPC = path.join(rootDir, '.gTTS', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python');
    const rutaVPS = path.join(rootDir, '.gTTS', 'bin', 'python'); // La ruta que mencionaste: ~/core_bot/.gTTS/bin/python

    // Elegimos la que realmente exista en el disco
    let pythonPath = fs.existsSync(rutaVPS) ? rutaVPS : rutaPC;

    const scriptPath = path.join(__dirname, 'narrador.py');
    const tempDocx = path.join(rootDir, `temp_${Date.now()}.docx`);
    const tempMp3 = path.join(rootDir, `temp_${Date.now()}.mp3`);

    console.log(`[TTS] Intentando usar: ${pythonPath}`);

    try {
        if (!fs.existsSync(pythonPath)) {
            return await sock.sendMessage(jid, { 
                text: `❌ Error de configuración: No se encontró el motor Python.\nBuscado en: ${pythonPath}` 
            });
        }

        fs.writeFileSync(tempDocx, Buffer.from(media.data, 'base64'));
        await sock.sendMessage(jid, { text: '⏳ Procesando narración... un momento.' });

        const pythonProcess = spawn(pythonPath, [scriptPath, tempDocx, tempMp3]);

        // ... resto de la lógica de stdout y stderr (igual que antes) ...
        pythonProcess.stdout.on('data', async (data) => {
            const result = data.toString().trim();
            if (result === "OK") {
                await sock.sendMessage(jid, { 
                    audio: { url: tempMp3 }, 
                    mimetype: 'audio/mpeg',
                    ptt: true 
                }, { quoted: m });
            }
        });

    } catch (error) {
        console.error('Error en ttsHandler:', error);
    } finally {
        setTimeout(() => {
            if (fs.existsSync(tempDocx)) fs.unlinkSync(tempDocx);
            if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        }, 20000);
    }
}

module.exports = ttsHandler;