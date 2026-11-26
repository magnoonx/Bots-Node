const FlexSearch = require('flexsearch');
const fs = require('fs');
const path = require('path');

// 1. Definimos las rutas correctamente
const DATA_DIR = path.join(__dirname, '../../data');
const STORE_PATH = path.join(DATA_DIR, 'web_index.json');

// 2. Configuramos el índice con "enrich: true" para poder recuperar el contenido
const index = new FlexSearch.Document({
    document: { 
        id: "id", 
        index: ["content"], 
        store: ["content", "url"] 
    },
    tokenize: "forward",
    context: true
});

async function saveToStore(pages) {
    try {
        // Asegurar que la carpeta data existe
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        console.log(`🧠 Indexando ${pages.length} páginas con técnica de solapamiento...`);

        pages.forEach((page, i) => {
            const size = 1200;
            const overlap = 200;
            const content = page.content || "";
            
            // Lógica de fragmentación (Chunking) con solapamiento
            for (let start = 0; start < content.length; start += (size - overlap)) {
                const chunk = content.substring(start, start + size);
                const chunkId = `${i}_${start}`;
                
                // Agregamos al índice incluyendo la URL de origen en el contenido
                index.add({ 
                    id: chunkId, 
                    url: page.url, 
                    content: `ORIGEN: ${page.url}\nCONTENIDO: ${chunk}` 
                });
            }
        });

        // Guardar copia de seguridad en JSON
        fs.writeFileSync(STORE_PATH, JSON.stringify(pages));
        console.log("✅ Base de datos local actualizada correctamente.");
    } catch (error) {
        console.error("❌ Error al guardar en el store:", error.message);
    }
}

function searchContext(query) {
    try {
        // Buscamos con enrich para obtener el objeto guardado
        const results = index.search(query, { 
            limit: 4, 
            enrich: true,
            suggest: true 
        });

        if (!results || results.length === 0) return "";

        // FlexSearch devuelve un array por cada campo indexado. 
        // Accedemos al resultado del campo "content"
        const fieldResult = results.find(r => r.field === "content");
        
        if (!fieldResult || !fieldResult.result) return "";

        // Extraemos el contenido de los documentos encontrados
        return fieldResult.result
            .map(item => item.doc.content)
            .join("\n\n---\n\n");
            
    } catch (error) {
        console.error("❌ Error en la búsqueda de contexto:", error.message);
        return "";
    }
}

module.exports = { saveToStore, searchContext };