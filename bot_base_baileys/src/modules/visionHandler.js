async function extractTextFromImage(imageBuffer) {
    let Tesseract;
    try {
        Tesseract = require('tesseract.js');
    } catch (e) {
        console.warn('tesseract.js no está instalado. OCR deshabilitado. Para habilitar, ejecuta: npm install tesseract.js');
        return null;
    }

    try {
        const { data: { text } } = await Tesseract.recognize(
            imageBuffer,
            'spa', // Idioma español
            { logger: m => console.log(m) } // Opcional: ver progreso
        );
        return text;
    } catch (error) {
        console.error("❌ Error en OCR:", error);
        return null;
    }
}

module.exports = { extractTextFromImage };