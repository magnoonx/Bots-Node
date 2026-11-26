const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { pipeline, env } = require('@xenova/transformers');
const { WaveFile } = require('wavefile');

let transcriber = null;

env.remoteTimeout = 60000;

async function getTranscriber() {
    try {
        if (!transcriber) {
            console.log("📥 Cargando Whisper Small (esto puede tardar la primera vez)...");
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
                // Forzamos el uso de la versión cuantizada (más ligera y rápida)
                quantized: true 
            });
            console.log("✅ Modelo Small cargado con éxito.");
        }
        return transcriber;
    } catch (error) {
        console.error("❌ Error al inicializar el modelo:", error);
        throw error;
    }
}

async function convertOggToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('wav')
            .audioChannels(1)
            .audioFrequency(16000)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}

async function processVoice(media) {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempOgg = path.join(__dirname, `../../temp_audio_${uniqueId}.ogg`);
    const tempWav = path.join(__dirname, `../../temp_audio_${uniqueId}.wav`);

    try {
        fs.writeFileSync(tempOgg, Buffer.from(media.data, 'base64'));
        await convertOggToWav(tempOgg, tempWav);

        // --- SOLUCIÓN AL ERROR DE AUDIOCONTEXT ---
        const buffer = fs.readFileSync(tempWav);
        const wav = new WaveFile(buffer);
        wav.toBitDepth('32f'); // Convertir a 32-bit float
        wav.toSampleRate(16000); // Asegurar 16kHz
        let audioData = wav.getSamples();
        if (Array.isArray(audioData) && audioData.length > 0) {
            audioData = audioData[0];
        }
        // -----------------------------------------

        const transcribe = await getTranscriber();
        const output = await transcribe(audioData, { 
            language: 'spanish',
            task: 'transcribe',
            prompt: 'Registro, referencia, agenda, cita, paciente, estatus' 
        });

        return output.text.trim();
    } catch (error) {
        console.error("Error en audioHandler:", error);
        return null;
    } finally {
        // Limpiar archivos temporales de forma segura
        if (fs.existsSync(tempOgg)) {
            try { fs.unlinkSync(tempOgg); } catch (e) {}
        }
        if (fs.existsSync(tempWav)) {
            try { fs.unlinkSync(tempWav); } catch (e) {}
        }
    }
}

module.exports = { processVoice };