const axios = require('axios');
const cheerio = require('cheerio');

async function getWebsiteContent(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);

        // Eliminar elementos innecesarios
        $('script, style, nav, footer, header, noscript').remove();

        // Extraer texto limpio
        const text = $('body').text()
            .replace(/\s\s+/g, ' ') // Quitar espacios extra
            .trim();

        // Limitamos el texto a los primeros 5000 caracteres para no saturar el prompt
        return text.substring(0, 5000);
    } catch (error) {
        console.error("❌ Error al escanear la web:", error.message);
        return null;
    }
}

module.exports = { getWebsiteContent };