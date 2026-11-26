const { google } = require('googleapis');
const auth = require('../services/auth');

const SPREADSHEET_ID = '1fkpHSmHMzBgPMdV2ktrSz0w003nKtu2CuyM7zTZiFOw';

async function saveRecord(user, text) {
    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const values = [[
            new Date().toLocaleString(),
            user.id_referencia, // Genérico
            user.nombre,
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
        console.error('Error en Sheets:', error);
        return false;
    }
}

async function checkStatus(idReferencia) {
    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hoja1!A:E', // Asumiendo que la columna E tiene el estatus
        });

        const filas = res.data.values;
        // Buscamos la última fila que coincida con el ID de referencia
        const miRegistro = filas.reverse().find(f => f[1] === idReferencia);

        if (miRegistro) {
            return `📊 *Estatus de solicitud (${idReferencia}):*\n${miRegistro[4] || 'En proceso'}`;
        }
        return "⚠️ No se encontró ningún registro con tu ID de referencia.";
    } catch (error) {
        return "❌ Error al consultar el estatus.";
    }
}

module.exports = { saveRecord, checkStatus };