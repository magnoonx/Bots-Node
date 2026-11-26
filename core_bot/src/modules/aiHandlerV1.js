const axios = require('axios');

async function getAIResponse(prompt, datosNegocio, contextoWeb = null) {
    const nombre = datosNegocio?.nombre || "EDDIA Consultores";
    
    // Si hay contexto de una web, el prompt cambia radicalmente
    let systemInstruction = "";
    
    if (contextoWeb) {
        systemInstruction = `Eres un experto en el sitio web de ${nombre}. 
        Tu objetivo es responder preguntas basándote ÚNICAMENTE en la siguiente información extraída de su página:
        
        --- INFORMACIÓN DE LA WEB ---
        ${contextoWeb}
        -----------------------------
        
        Si el usuario pregunta algo que NO está en el texto anterior, responde amablemente que no tienes esa información específica pero invítalo a contactar a soporte: ${datosNegocio.contacto?.whatsapp_soporte}.
        Responde de forma concisa y profesional.`;
    } else {
        // Tu prompt original
        systemInstruction = `Eres el asistente de "${datosNegocio.nombre}".
        Información del negocio: ${datosNegocio.detalles}.
        ... (resto de tu prompt original) ...`;
    }

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "nvidia/nemotron-nano-9b-v2:free",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ]
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || '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'}`,
                "HTTP-Referer": "http://localhost:3000", 
                "X-Title": "CoreBot Generic", 
                "Content-Type": "application/json"
            }
        });

        if (response.data?.choices?.[0]) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error("Respuesta de IA vacía");
        }
    } catch (error) {
        console.error("❌ Error en AI Handler:", error.response?.data || error.message);
        return "Lo siento, tuve un problema al procesar la información de la web.";
    }
}

module.exports = { getAIResponse };