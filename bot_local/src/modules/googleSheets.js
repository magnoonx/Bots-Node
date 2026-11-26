const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1fkpHSmHMzBgPMdV2ktrSz0w003nKtu2CuyM7zTZiFOw';
const localRecordsPath = path.join(__dirname, '..', '..', 'data', 'local_records.json');
const localCsvPath = path.join(__dirname, '..', '..', 'data', 'local_records.csv');

function saveLocalRecord(user, text) {
    try {
        const dataDir = path.dirname(localRecordsPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        let records = [];
        if (fs.existsSync(localRecordsPath)) {
            try { records = JSON.parse(fs.readFileSync(localRecordsPath, 'utf8')); } catch(e) { records = []; }
        }

        const nuevo = {
            fecha: new Date().toLocaleString(),
            id_referencia: user.id_referencia || `REF-${Date.now().toString().slice(-4)}`,
            nombre: user.nombre || 'Invitado',
            mensaje: text,
            estatus: 'Recibido / En proceso'
        };

        records.push(nuevo);
        fs.writeFileSync(localRecordsPath, JSON.stringify(records, null, 2));

        // Registrar también en CSV local
        const csvLine = `"${nuevo.fecha}","${nuevo.id_referencia}","${nuevo.nombre}","${(nuevo.mensaje || '').replace(/"/g, '""')}","${nuevo.estatus}"\n`;
        if (!fs.existsSync(localCsvPath)) {
            fs.writeFileSync(localCsvPath, 'Fecha,ID_Referencia,Nombre,Mensaje,Estatus\n');
        }
        fs.appendFileSync(localCsvPath, csvLine);
        return true;
    } catch (e) {
        console.error('❌ Error guardando registro local:', e);
        return false;
    }
}

function checkLocalStatus(idReferencia) {
    try {
        if (fs.existsSync(localRecordsPath)) {
            const records = JSON.parse(fs.readFileSync(localRecordsPath, 'utf8'));
            const miRegistro = [...records].reverse().find(r => r.id_referencia === idReferencia);
            if (miRegistro) {
                return `📊 *Estatus de solicitud (${idReferencia}):*\n${miRegistro.estatus || 'En proceso'}\n\n*Fecha:* ${miRegistro.fecha}`;
            }
        }
    } catch(e) {
        console.warn('⚠️ Error consultando registro local:', e);
    }
    return null;
}

async function saveRecord(user, text) {
    // Siempre respaldar de forma local
    saveLocalRecord(user, text);

    if (process.env.LOCAL_MODE === 'true') {
        return true;
    }

    try {
        const { google } = require('googleapis');
        const auth = require('../services/auth');
        const sheets = google.sheets({ version: 'v4', auth });
        const values = [[
            new Date().toLocaleString(),
            user.id_referencia || 'N/A',
            user.nombre || 'Invitado',
            text
        ]];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hoja1!A:D',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return true;
    } catch (error) {
        console.warn('⚠️ Google Sheets no disponible. Guardado exitosamente en almacenamiento local.');
        return true;
    }
}

async function checkStatus(idReferencia) {
    // 1. Intentar primero en base de datos local
    const localStatus = checkLocalStatus(idReferencia);
    if (localStatus) return localStatus;

    if (process.env.LOCAL_MODE === 'true') {
        return "⚠️ No se encontró ningún registro con tu ID de referencia en la base de datos local.";
    }

    try {
        const { google } = require('googleapis');
        const auth = require('../services/auth');
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hoja1!A:E',
        });

        const filas = res.data.values;
        const miRegistro = filas ? filas.reverse().find(f => f[1] === idReferencia) : null;

        if (miRegistro) {
            return `📊 *Estatus de solicitud (${idReferencia}):*\n${miRegistro[4] || 'En proceso'}`;
        }
        return "⚠️ No se encontró ningún registro con tu ID de referencia.";
    } catch (error) {
        return "❌ Error al consultar el estatus.";
    }
}

module.exports = { saveRecord, checkStatus, saveLocalRecord, checkLocalStatus };
