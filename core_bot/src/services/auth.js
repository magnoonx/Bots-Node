const { JWT } = require('google-auth-library');
// Subimos dos niveles para llegar a la carpeta config
const credenciales = require('../../config/google-credentials.json');

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar.readonly'
];

const auth = new JWT({
    email: credenciales.client_email,
    key: credenciales.private_key,
    scopes: SCOPES,
});

module.exports = auth;