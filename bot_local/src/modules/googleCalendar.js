const fs = require('fs');
const path = require('path');

function getLocalEvents() {
    try {
        const calPath = path.join(__dirname, '..', '..', 'data', 'calendar_events.json');
        if (fs.existsSync(calPath)) {
            const raw = fs.readFileSync(calPath, 'utf8');
            const eventos = JSON.parse(raw);
            if (!eventos || eventos.length === 0) return "📅 No hay actividades programadas para hoy en la agenda local.";

            let mensaje = "📅 *Agenda de hoy (Calendario Local):*\n";
            eventos.forEach(e => {
                mensaje += `\n• ${e.hora || 'Todo el día'} - ${e.summary}`;
            });
            return mensaje;
        }
    } catch (e) {
        console.warn('⚠️ Error leyendo calendario local:', e.message);
    }
    return "📅 No hay actividades programadas para hoy.";
}

async function getDailyEvents(calendarId) {
    // Si el modo local está forzado, usar directamente el calendario local
    if (process.env.LOCAL_MODE === 'true' || process.env.LOCAL_CALENDAR === 'true') {
        return getLocalEvents();
    }

    try {
        const { google } = require('googleapis');
        const auth = require('../services/auth');

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
        if (!eventos || eventos.length === 0) return "📅 No hay actividades programadas para hoy en Google Calendar.";

        let mensaje = "📅 *Actividades para hoy:*\n";
        eventos.forEach(e => {
            const inicio = new Date(e.start.dateTime || e.start.date);
            const hora = inicio.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
            mensaje += `\n• ${hora} - ${e.summary}`;
        });
        return mensaje;
    } catch (error) {
        console.warn('⚠️ Google Calendar no disponible o sin conexión. Usando calendario local.');
        return getLocalEvents();
    }
}

module.exports = { getDailyEvents };
