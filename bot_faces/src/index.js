const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const aiHandler = require('./modules/aiHandler');
const webHandler = require('./modules/webHandler');
const vectorStore = require('./modules/vectorStore');
const configNegocio = {
    nombre: "Facultad de Ciencias Económicas y Sociales - Universidad de Carabobo",
    rubro: "Educación Universitaria, Formación Profesional, Postgrados, Formación Gerencial, Cursos",
    contacto: {
        whatsapp_soporte: "+584128876344",
        web: "https://faces.uc.edu.ve/"
    }
};

// 2. DEFINICIÓN DE VARIABLES GLOBALES (IMPORTANTE: Deben ir aquí arriba)
let cacheWeb = null; 
let ultimaActualizacion = 0;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions' }),
    puppeteer: { 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log('🚀 Bot FACES UC Online.');
    // Indexamos TODO al iniciar (o puedes hacerlo una vez al día)
    await webHandler.performFullIndex(configNegocio.contacto.web);
    console.log('✅ Base de datos de la facultad actualizada.');
});

// 3. MANEJO DE MENSAJES
client.on('message', async msg => {
    if (msg.from.includes('@g.us')) return;

    const textoUsuario = msg.body.toLowerCase();
    let contexto = "";

    // Si es un saludo simple, NO buscamos en la web (ahorramos tokens)
    const esSaludo = /^(hola|buenos dias|buenas tardes|saludos|que tal)/.test(textoUsuario);

    if (!esSaludo) {
        contexto = vectorStore.searchContext(msg.body);
    }

    const chat = await msg.getChat();
    await chat.sendStateTyping();

    const respuesta = await aiHandler.getAIResponse(msg.body, configNegocio, contexto);
    await msg.reply(respuesta);
});

client.initialize();