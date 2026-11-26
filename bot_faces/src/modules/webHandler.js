const axios = require('axios');
const cheerio = require('cheerio');
const vectorStore = require('./vectorStore');

async function performFullIndex(baseUrl) {
    try {
        const sitemapUrl = `${baseUrl.replace(/\/$/, '')}/wp-sitemap-posts-page-1.xml`; 
        const sitemapRes = await axios.get(sitemapUrl, { timeout: 10000 });
        const $sitemap = cheerio.load(sitemapRes.data, { xmlMode: true });
        
        const links = [];
        $sitemap('loc').each((i, el) => links.push($sitemap(el).text()));

        console.log(`🚀 Iniciando indexación de ${links.length} páginas...`);
        const pagesData = [];

        for (const link of links.slice(0, 80)) { // Límite de 80 para no saturar la red
            try {
                const { data } = await axios.get(link, { timeout: 5000 });
                const $ = cheerio.load(data);
                $('script, style, nav, footer, header').remove();
                const text = $('body').text().replace(/\s\s+/g, ' ').trim();
                pagesData.push({ url: link, content: text });
            } catch (e) { console.log(`Skipping: ${link}`); }
        }

        await vectorStore.saveToStore(pagesData);
        return true;
    } catch (e) {
        console.error("Error indexando:", e.message);
        return false;
    }
}

module.exports = { performFullIndex };