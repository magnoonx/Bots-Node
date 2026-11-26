const fs = require('fs');
const path = require('path');
const https = require('https');

// Modelos disponibles para descarga directa
const MODELOS = {
    'llama-3.2-3b': {
        nombre: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        tamanoAprox: '2.02 GB',
        descripcion: 'Ultra ligero y rápido (Recomendado para portabilidad: 4-8 GB RAM)'
    },
    'llama-3.1-8b': {
        nombre: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
        tamanoAprox: '4.92 GB',
        descripcion: 'Máxima precisión en español y RAG (Requiere 8 GB VRAM o 16 GB RAM)'
    }
};

const modeloKey = process.argv[2] || 'llama-3.2-3b';
const modeloConfig = MODELOS[modeloKey] || MODELOS['llama-3.2-3b'];

const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

const destino = path.join(modelsDir, modeloConfig.nombre);

if (fs.existsSync(destino)) {
    console.log(`✅ El modelo ya existe en la carpeta local:\n${destino}`);
    console.log(`Tamaño: ${(fs.statSync(destino).size / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    process.exit(0);
}

console.log('==============================================================');
console.log(`   DESCARGA DIRECTA DE MODELO GGUF (100% PORTABLE)`);
console.log('==============================================================');
console.log(`Modelo:       ${modeloConfig.nombre}`);
console.log(`Detalle:      ${modeloConfig.descripcion}`);
console.log(`Tamaño aprox: ${modeloConfig.tamanoAprox}`);
console.log(`Destino:      ${destino}`);
console.log('==============================================================\n');

function descargarConRedirecciones(url, archivoDestino) {
    const file = fs.createWriteStream(archivoDestino);
    
    https.get(url, (res) => {
        // Seguir redirecciones de Hugging Face (302 / 307)
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
            return descargarConRedirecciones(res.headers.location, archivoDestino);
        }

        if (res.statusCode !== 200) {
            console.error(`❌ Error en la descarga. Código HTTP: ${res.statusCode}`);
            file.close();
            try { fs.unlinkSync(archivoDestino); } catch(e) {}
            process.exit(1);
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        let lastReport = Date.now();

        res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            file.write(chunk);

            const now = Date.now();
            if (now - lastReport > 1000) {
                lastReport = now;
                const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
                const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';
                const pct = totalBytes > 0 ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : '?';
                process.stdout.write(`⏳ Descargando: ${mb} MB / ${totalMb} MB (${pct}%)\r`);
            }
        });

        res.on('end', () => {
            file.end(() => {
                console.log(`\n\n✅ ¡Descarga completa!`);
                console.log(`Archivo guardado exitosamente en: ${archivoDestino}`);
            });
        });
    }).on('error', (err) => {
        console.error('\n❌ Error durante la descarga:', err.message);
        file.close();
        try { fs.unlinkSync(archivoDestino); } catch(e) {}
        process.exit(1);
    });
}

descargarConRedirecciones(modeloConfig.url, destino);
