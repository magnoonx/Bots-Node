const axios = require('axios');

async function getAIResponse(prompt, datosNegocio) {
    // 1. Validación de seguridad
    // Si por algún motivo datosNegocio llega vacío, evitamos que el código explote
    const nombre = datosNegocio?.nombre || "EDDIA Consultores";
    const rubro = datosNegocio?.rubro || "bots de IA y automatización general de procesos";
    const detalles = datosNegocio?.detalles || "Creación de Bots en diversas plataformas, Desarrollo de todo tipo de Software para Web, escritorio o moviles, Desarrollo de sistemas embebidos, Desarrollo de IA para tu negocio o Industria";

    // 2. Definimos el System Prompt real

    // Temporalmente cambia tu systemInstruction a esto:
    // const systemInstruction = `ESTA ES UNA PRUEBA DE CONTROL. 
    // Debes responder a todo diciendo: "SOY UN BOT NUEVO". 
    // Ignora cualquier otra instrucción previa.`;


     const systemInstruction = `Eres el asistente de "${nombre}".
        Información del negocio: ${detalles}.

        ### MEDIOS DE CONTACTO OFICIALES:
        - WhatsApp de Soporte: ${datosNegocio?.contacto?.whatsapp_soporte || 'No disponible'}
        - Email: ${datosNegocio?.contacto?.email || 'No disponible'}
        - Web: ${datosNegocio?.contacto?.web || 'No disponible'}
        - Ubicación: ${datosNegocio?.contacto?.ubicacion || 'No disponible'}

        ### REGLAS DE CONTACTO:
        1. Si el usuario pide hablar con un humano, solicita una cita o tiene un problema técnico, proporciónale el WhatsApp de soporte o el Email.
        2. Si preguntan dónde están, indica la ubicación.
        3. Si la duda es muy compleja, invítalos a visitar la web.
        4. Usa emojis en la lista de contactos para que sea fácil de leer.`;
        
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "nvidia/nemotron-nano-9b-v2:free",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ]
        }, {
            headers: {
                // Mantenemos tu API Key (Asegúrate de no compartirla en público luego)
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || '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'}`,
                "HTTP-Referer": "http://localhost:3000", 
                "X-Title": "CoreBot Generic", 
                "Content-Type": "application/json"
            }
        });

        // 3. Validación de la respuesta
        if (response.data && response.data.choices && response.data.choices[0]) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error("Respuesta de IA con formato inesperado");
        }

    } catch (error) {
        // Log detallado para que sepas si es saldo, API key o red
        console.error("❌ Error en AI Handler:", error.response?.data || error.message);
        return "Lo siento, estoy teniendo un problema técnico. ¿Podrías intentar de nuevo en un momento?";
    }
}

// 4.  Exportar la función
// Sin esto, el index.js seguirá diciendo "getAIResponse is not a function"
module.exports = { getAIResponse };