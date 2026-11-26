const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const aiHandler = require('./modules/aiHandler');

// Carga de módulos propios
const calendar = require('./modules/googleCalendar');
const sheets = require('./modules/googleSheets');
const audioHandler = require('./modules/audioHandler');

// Función de utilidad para pausas
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// CONFIGURACIÓN DINÁMICA DEL NEGOCIO (Puedes mover esto a un JSON luego)
const configNegocio = {
    nombre: "EDDIA Consultores",
    rubro: "Bots de IA y automatización general de procesos",
    detalles: "Creación de Bots, Desarrollo de Software Web/Móvil, Sistemas embebidos e IA industrial.",
    contacto: {
        whatsapp_soporte: "+584128876344",
        email: "",
        web: "https://eddia.com.ve",
        ubicacion: "Valencia, Venezuela"
    }
};

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1040225260-alpha.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

const CALENDAR_ID = 'denrique.duarte@gmail.com';

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🚀 CoreBot Genérico Operativo.'));

client.on('message', async msg => {
    // 1. FILTRO: Ignorar mensajes de grupos y estados
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return; 

    // 2. Obtener identidad de WhatsApp
    let nombreWhatsApp = "Usuario";
    try {
        const contact = await msg.getContact();
        nombreWhatsApp = contact.name || contact.pushname || "Usuario";
    } catch (e) {
        nombreWhatsApp = msg._data?.notifyName || "Usuario";
    }

    // 3. Cargar base de datos local
    let usuariosActualizados = {};
    const usersPath = path.join(__dirname, '../data/users.json');
    try {
        if (fs.existsSync(usersPath)) {
            const db = fs.readFileSync(usersPath, 'utf-8');
            usuariosActualizados = JSON.parse(db);
        }
    } catch (e) {
        console.log("❌ Error leyendo base de datos JSON");
        return;
    }

    const numero = msg.from.replace('@c.us', '');
    const body = msg.body.toLowerCase();
    const user = usuariosActualizados[numero];

    // 4. Determinar nombre final
    const nombreFinal = user?.nombre || nombreWhatsApp;

    // 5. DETECTAR NOTA DE VOZ
    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
        console.log("🎤 Audio recibido, procesando...");
        const media = await msg.downloadMedia();
        const textoTranscrito = await audioHandler.processVoice(media);
        
        if (textoTranscrito) {
            const textoLimpio = textoTranscrito.replace(/[.\s]/g, ''); 
            if (textoLimpio.length >= 1) {
                msg.body = textoLimpio; 
                msg.hasMedia = false; 
                msg.type = 'chat';
                console.log(`🔄 Re-inyectando comando de voz: "${textoLimpio}"`);
                return client.emit('message', msg); 
            }
        }
    }

    // 6. Bloque de seguridad para usuarios no registrados
    if (!user) {
        if (['hola', 'menu', 'ayuda'].some(t => body.includes(t))) {
            return msg.reply(`Hola *${nombreWhatsApp}*, no reconozco este número en mi sistema. Por favor, contacta al soporte.`);
        }
        return; 
    }

    // 7. LÓGICA DE MENÚ FÍSICO
    if (body === '1' || body.includes('registro')) {
        return msg.reply(`Nuestros servicios *${nombreFinal}*, son: \n\n 🤖Creación de Bots en diversas plataformas\n\n 💻Desarrollo de todo tipo de Software para Web, escritorio o moviles\n\n 🏭Desarrollo de sistemas embebidos comerciales e industriales\n\n 🦾Desarrollo de IA para tu negocio o Industria`);
    }

    if (body.length > 5 && !isNaN(body)) {
        const ok = await sheets.saveRecord(user, msg.body);
        return msg.reply(ok ? `✅ Registro exitoso, *${nombreFinal}*.` : '❌ Error al registrar en la nube.');
    }

    if (body === '4' || body.includes('estatus')) {
        await msg.reply(`*${nombreFinal}*, estamos buscando tu solicitud...⏳`);
        const estatus = await sheets.checkStatus(user.id_referencia);
        await delay(3000); // Reducido a 3s para mejor UX, pero puedes dejarlo en 6000
        return msg.reply(`*${nombreFinal}*, el estatus es:\n\n${estatus}`);
    }

    if (body === '3' || body.includes('agenda')) {
        await msg.reply(`*${nombreFinal}*, consultando agenda...⏳`);
        const agenda = await calendar.getDailyEvents(CALENDAR_ID);
        await delay(3000);
        return msg.reply(`📅 *Agenda de hoy para ${nombreFinal}:*\n\n${agenda}`);
    }

    // 8. MENÚ PRINCIPAL (Saludos y palabras clave)
    if (['hola', 'menu', 'ayuda', 'inicio'].some(t => body.includes(t)) || body === '?') {
        return msg.reply(`*¡Hola ${nombreFinal}!* 👋\n\n¿En qué puedo ayudarte hoy?\n\n1️⃣ Información\n2️⃣ Servicios Ofrecidos\n3️⃣ Ver Demo`);
    }

    // 9. IA (CATCH-ALL): Si no es nada de lo anterior, responde la IA
    // console.log(`🧠 Procesando con IA para: ${nombreFinal}`);
    
    // Mostramos estado "Escribiendo..." para naturalidad
    const chat = await msg.getChat();
    await chat.sendStateTyping();

    const respuestaIA = await aiHandler.getAIResponse(msg.body, configNegocio);
    return msg.reply(respuestaIA);
});

client.initialize();