const fs = require('fs');
const path = require('path');

const sessionsDir = path.join(__dirname, '..', '..', 'data', 'sessions');

/**
 * Garantiza que el directorio de sesiones exista
 */
function ensureSessionsDir() {
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
}

/**
 * Obtiene la ruta del archivo de sesión para un usuario dado
 */
function getSessionFilePath(jid) {
    ensureSessionsDir();
    const safeJid = jid.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(sessionsDir, `${safeJid}.json`);
}

/**
 * Carga el historial de conversación persistente de un usuario
 */
function loadChatHistory(jid) {
    try {
        const filePath = getSessionFilePath(jid);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data.history)) {
                return data.history;
            }
        }
    } catch (err) {
        console.warn(`⚠️ Error leyendo historial de sesión para ${jid}:`, err.message);
    }
    return null;
}

/**
 * Guarda el historial de conversación en disco
 */
function saveChatHistory(jid, history, metadata = {}) {
    try {
        const filePath = getSessionFilePath(jid);
        const data = {
            jid: jid,
            updatedAt: new Date().toISOString(),
            lastTimestamp: Date.now(),
            metadata: metadata,
            history: history
        };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`❌ Error guardando historial de sesión para ${jid}:`, err.message);
        return false;
    }
}

/**
 * Borra la sesión persistente de un usuario (para comandos como /reset o /limpiar)
 */
function clearChatHistory(jid) {
    try {
        const filePath = getSessionFilePath(jid);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🧹 [Sesión] Memoria borrada para ${jid}`);
            return true;
        }
    } catch (err) {
        console.error(`❌ Error borrando sesión para ${jid}:`, err.message);
    }
    return false;
}

module.exports = {
    loadChatHistory,
    saveChatHistory,
    clearChatHistory,
    getSessionFilePath
};
