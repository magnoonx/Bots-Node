const Groq = require('groq-sdk');
// Inicializamos Groq con tu API Key
const groq = new Groq({
    apiKey: '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'
});

async function getAIResponse(prompt, datosNegocio) {
    // 1. Validación de seguridad y valores por defecto
    const nombre = datosNegocio?.nombre || "EDDIA Consultores";
    const rubro = datosNegocio?.rubro || "bots de IA y automatización general de procesos";
    const detalles = datosNegocio?.detalles || "Creación de Bots, Desarrollo de Software y Sistemas embebidos.";

    // 2. Definimos el System Prompt (Manteniendo tus reglas originales)
    const systemInstruction = `Eres el asistente de "${nombre}".
        Información del negocio: ${detalles}.

        ### INSTRUCCIÓN DE PERSONALIZACIÓN:
        - Recibirás el nombre del usuario al principio del mensaje entre paréntesis, por ejemplo: "(Conversando con: Juan)".
        - Úsalo para saludarlo de forma natural (ej: "Hola Juan," o "Un gusto saludarte, Juan").
        - Si el nombre es "Invitado", no hace falta que lo menciones, solo saluda cordialmente.  

        ### MEDIOS DE CONTACTO OFICIALES:
        - WhatsApp de Soporte: ${datosNegocio?.contacto?.whatsapp_soporte || 'No disponible'}
        - Email: ${datosNegocio?.contacto?.email || 'No disponible'}
        - Web: ${datosNegocio?.contacto?.web || 'No disponible'}
        - Ubicación: ${datosNegocio?.contacto?.ubicacion || 'No disponible'}



        ### REGLAS DE CONTACTO:
        1. Si el usuario pide hablar con un humano, solicita una cita o tiene un problema técnico, proporciónale el WhatsApp de soporte o el Email.
        2. Si preguntan dónde están, indica la ubicación.
        3. Si la duda es muy compleja, invítalos a visitar la web.
        4. Usa emojis en la lista de contactos para que sea fácil de leer.
        5. Sé conciso y amable.`;



    try {

        console.log("🤖 Consultando a Groq (Llama 3.3)...");

       

        const response = await groq.chat.completions.create({

            messages: [

                { role: "system", content: systemInstruction },

                { role: "user", content: prompt }

            ],

            // Usamos llama-3.3-70b-versatile por su gran equilibrio entre inteligencia y límites gratuitos

            model: "llama-3.3-70b-versatile",

            temperature: 0.7,

            max_tokens: 1024,

        });



        // 3. Validación y retorno de la respuesta

        if (response.choices && response.choices[0]) {

            return response.choices[0].message.content;

        } else {

            throw new Error("Respuesta de Groq con formato inesperado");

        }



    } catch (error) {

        // Manejo de errores detallado

        console.error("❌ Error en AI Handler (Groq):", error.message);

       

        if (error.status === 429) {

            return "Lo siento, estamos recibiendo muchas consultas. Por favor, intenta de nuevo en unos segundos.";

        }

       

        return "Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentar de nuevo?";

    }

}



// 4. Exportar la función

module.exports = { getAIResponse };