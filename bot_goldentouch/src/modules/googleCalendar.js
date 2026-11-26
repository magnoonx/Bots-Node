const { google } = require('googleapis');
const auth = require('../services/auth'); // Importamos el pasaporte central

async function getDailyEvents(calendarId) {
    try {
        const calendar = google.calendar({ version: 'v3', auth });
        const hoy = new Date();
        const start = new Date(hoy.setHours(0, 0, 0, 0)).toISOString();
        const end = new Date(hoy.setHours(23, 59, 59, 999)).toISOString();

        const res = await calendar.events.list({
            calendarId: calendarId,
            timeMin: start,
            timeMax: end,
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Caracas'
        });

        const eventos = res.data.items;
        if (!eventos || eventos.length === 0) return "📅 No hay actividades programadas para hoy.";

        let mensaje = "📅 *Actividades para hoy:*\n";
        eventos.forEach(e => {
            const inicio = new Date(e.start.dateTime || e.start.date);
            const hora = inicio.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
            mensaje += `\n• ${hora} - ${e.summary}`;
        });
        return mensaje;
    } catch (error) {
        console.error('Error en Calendar:', error);
        return "❌ Error al consultar la agenda.";
    }
}

module.exports = { getDailyEvents };