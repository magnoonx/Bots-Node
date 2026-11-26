# CoreBot EDDIA (bot_base_baileys) - Technical Documentation

## 1. Overview and Functions
**CoreBot EDDIA** is a multi-functional, AI-powered WhatsApp bot created for "EDDIA Consultores". It acts as an intelligent virtual assistant capable of processing text, voice, images, and documents.

### Core Functions:
- **Conversational AI**: Handles natural language queries using AI (via the Groq SDK).
- **PDF Document Analysis**: Users can upload PDF documents, and the bot indexes them to answer specific questions based on the document's content.
- **Voice Message Processing**: Transcribes voice notes sent by the user, processes the text via AI, and responds intelligently.
- **Image Text Extraction (OCR)**: Analyzes images (like payment receipts) using Optical Character Recognition (OCR) to extract key data such as Bank, Amount, and Reference.
- **Word Document to Speech (TTS)**: Processes `.docx` files and converts their content into spoken audio using Text-To-Speech.
- **Google Calendar Integration**: Fetches and displays the daily agenda from an integrated Google Calendar.

---

## 2. Technologies Used
- **Runtime Environment**: Node.js
- **WhatsApp API**: `@whiskeysockets/baileys` (Connects via Web WhatsApp protocol, handling multi-device sessions).
- **Artificial Intelligence**: `groq-sdk` for fast LLM inference.
- **Computer Vision (OCR)**: `tesseract.js` for extracting text from images.
- **Document Processing**: `pdf-parse`, `pdfjs-dist`, `pdfkit` for PDFs; `mammoth` for Word documents.
- **Audio Processing**: `fluent-ffmpeg` for audio conversion, `node-gtts` for Text-To-Speech generation.
- **Google APIs**: `googleapis`, `google-auth-library` to access Google Calendar and Google Sheets.
- **Logging & Utilities**: `pino` for logging, `qrcode-terminal` to generate the WhatsApp login QR code in the console.

---

## 3. Structure and Architecture
The project follows a **Modular Architecture**, separating the main WhatsApp connection logic from the specific processing handlers (AI, vision, audio, documents).

### Architecture Flow:
1. **Connection Layer (`src/index.js`)**: Initializes the Baileys socket, handles QR code generation, session state (saved in `auth_info/`), and listens to incoming messages (`messages.upsert`).
2. **Message Routing**: Incoming messages are evaluated based on their type (text, image, audio, document).
3. **Handler Execution (Modules)**:
   - *Text*: Goes to `aiHandler` or specific command triggers (like menu options).
   - *Audio*: Downloaded, converted, and sent to `audioHandler`.
   - *Image*: Downloaded and sent to `visionHandler`.
   - *PDF*: Stored locally in `data/pdfs/` and processed via `pdfHandler` and `aiHandler`.
   - *Word*: Processed by `ttsHandler` to generate an audio response.

---

## 4. Functional Files Description

- **`package.json`**: Defines the project's dependencies, such as `@whiskeysockets/baileys` and `tesseract.js`.
- **`src/index.js`**: The main script. It orchestrates the bot, sets up event listeners for incoming WhatsApp messages, manages active sessions/timers, and routes data to the correct modules.
- **`src/modules/aiHandler.js`**: Connects to the Groq AI service. It handles both general conversational prompts and specific document-based (RAG) queries.
- **`src/modules/audioHandler.js`**: Manages voice note transcription and processing.
- **`src/modules/visionHandler.js`**: Implements Tesseract.js to read text from uploaded images (e.g., bank transfer screenshots).
- **`src/modules/pdfHandler.js`**: Handles the reading, chunking, and indexing of PDF files for the AI to query.
- **`src/modules/ttsHandler.js`**: Takes Word documents, extracts their text, and converts it to audio using TTS.
- **`src/modules/googleCalendar.js`**: Authenticates and interacts with the Google Calendar API to fetch daily events.
- **`config/google-credentials.json`**: The service account credentials required for Google APIs.
- **`auth_info/`**: A dynamically generated directory by Baileys that stores the WhatsApp authentication state, allowing the bot to stay logged in after restarts.

---

## 5. File Structure Tree

```text
bot_base_baileys/
├── package.json               # Project dependencies and scripts
├── package-lock.json          # Dependency lockfile
├── auth_info/                 # WhatsApp multi-device authentication state
├── config/
│   └── google-credentials.json # Google API service account keys
├── data/                      # Local storage for user uploads (e.g., PDFs)
├── scripts/                   # Utility/maintenance scripts
├── spa.traineddata            # Tesseract OCR language data (Spanish)
└── src/
    ├── index.js               # Main Bot Entry Point & WhatsApp listener
    ├── modules/
    │   ├── aiHandler.js       # Groq AI & RAG logic
    │   ├── audioHandler.js    # Voice message transcription
    │   ├── googleCalendar.js  # Google Calendar API integration
    │   ├── googleSheets.js    # Google Sheets API integration
    │   ├── pdfHandler.js      # PDF extraction and processing
    │   ├── ttsHandler.js      # Text-to-Speech generation
    │   └── visionHandler.js   # Image OCR processing
    └── services/
        └── auth.js            # General authentication utilities
```
