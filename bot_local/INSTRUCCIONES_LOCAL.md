# Bot de David (Modo API en la Nube con Memoria Persistente)

Este bot está optimizado para servidores con recursos limitados (como Debian con 1 o 2 GB de RAM), utilizando APIs en la nube de alta velocidad (**Google Gemini AI** y **OpenRouter**) para el procesamiento de texto y voz.

---

## Características Activas

1. **Inferencia por API**:
   - **Prioridad 1**: Google Gemini AI (`gemini-1.5-flash`, `gemini-2.0-flash`).
   - **Prioridad 2 (Fallback)**: OpenRouter (`deepseek-r1`, `llama-3.1-8b`, `gemini-flash`).
2. **Memoria Persistente de Conversación**:
   - Guarda el historial de cada usuario en `data/sessions/<id_usuario>.json`.
   - Recuerda el contexto completo de la conversación incluso si el servidor o el bot se reinician.
   - El usuario puede escribir **/reset** en WhatsApp para borrar su memoria cuando lo desee.
3. **Transcripción de Notas de Voz (STT Nube)**:
   - Utiliza Gemini Multimodal y Hugging Face Whisper Router directamente en la nube sin gastar RAM ni disco en el servidor.
4. **Respuestas Pragmáticas y Directas**:
   - Configurado como "Bot de David".
   - Sin fórmulas de cortesía ni saludos repetitivos en cada turno; responde directo al grano.
5. **RAG sobre Documentos PDF**:
   - Extracción local con `pdfjs-dist` y síntesis precisa vía API.

---

## Configuración (`.env`)

Asegúrate de tener tus claves en [.env](file:///.env):

```env
OPENROUTER_API_KEY=tu_clave_aqui
GEMINI_API_KEY=tu_clave_aqui
```

---

## Ejecución en Debian o Windows

```bash
# Iniciar el bot
node src/index.js
```
