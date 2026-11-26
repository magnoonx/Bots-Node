const Groq = require('groq-sdk');
const groq = new Groq({ 
    apiKey: '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' 
});

async function getAIResponse(prompt, datosNegocio, contextoWeb = null) {
    const nombre = datosNegocio?.nombre || "FACES Universidad de Carabobo";
    
    // --- NUEVO SYSTEM PROMPT ESTRICTO PARA LA WEB ---
    let systemInstruction = "";

    if (contextoWeb) {
    systemInstruction = `Eres el asistente virtual oficial de la Facultad de Ciencias Económicas y Sociales (FACES) de la Universidad de Carabobo (UC).

    Tu ÚNICA fuente de verdad es el "CONTEXTO DE LA WEB" proporcionado abajo. Este contexto contiene fragmentos de nuestra web oficial.

    --- CONTEXTO DE LA WEB ---
    ${contextoWeb}
    --------------------------

    REGLAS CRÍTICAS DE RESPUESTA:
    1) **Cero Alucinación**: Responde ÚNICAMENTE con la información que aparezca en el contexto arriba. Si la respuesta no está allí, di exactamente: "Lo siento, como asistente de FACES UC solo puedo responder dudas basadas en la información oficial de nuestra web. Para otros temas, contacta a soporte: ${datosNegocio.contacto?.whatsapp_soporte} 📞".
    2) **Exclusividad UC**: Esta facultad pertenece SOLO a la Universidad de Carabobo. No menciones NINGUNA otra universidad (UBA, LUZ, UCV, etc.) aunque el usuario lo pregunte.
    3) **Identificación de Origen**: En el contexto verás líneas que dicen "ORIGEN: url...". Úsalas para saber de qué sección hablas, pero NO las menciones textualmente al usuario (ej: no digas "según la url tal...").
    4) **Estilo**: Tono profesional, ejecutivo y amable. Usa emojis de forma estratégica (ej: 🎓 para carreras, 📅 para fechas, 📍 para ubicación).
    5) **Redes Sociales**: Si preguntan por redes, indica el nombre de la red y el usuario oficial de la facultad (ej: Instagram: @facesuc_oficial 📸).
    6) **No Técnico**: Jamás menciones que eres una IA, que usas Groq, Llama, o que estás leyendo fragmentos de texto. Eres el asistente de la facultad y punto.
    7) **Negocio**: Sobre la facultad en general: ${datosNegocio.rubro}.`;
    } else {
            systemInstruction = `Eres el asistente experto de ${nombre}. Responde de forma ejecutiva y profesional. Contacto: ${datosNegocio.contacto?.whatsapp_soporte}`;
            }

    try {
        console.log("🤖 Consultando a Groq (Llama 3.1) con contexto web...");
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.1, // Temperatura baja para máxima fidelidad a la web
            max_tokens: 1024,
        });

        if (response.choices && response.choices[0]) {
            return response.choices[0].message.content;
        } else {
            throw new Error("Respuesta de Groq inesperada");
        }
    } catch (error) {
        console.error("❌ Error en AI Handler (Groq):", error.message);
        return "Lo siento, tuve un problema al procesar la información de la facultad.";
    }
}

module.exports = { getAIResponse };