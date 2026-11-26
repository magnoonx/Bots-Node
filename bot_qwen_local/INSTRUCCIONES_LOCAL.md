# Guía del Bot 100% Portable (Inferencia en Memoria con Node.js)

Este proyecto funciona de forma **100% portable y autocontenida**. No requiere instalar Ollama, servidores externos ni dependencias en el sistema operativo Windows.

Todo el motor de inferencia corre directamente **dentro del proceso de Node.js** leyendo el modelo `.gguf` que se encuentra en la carpeta `models/`.

---

## 1. Descargar el Modelo en la Carpeta `models/`

El bot incluye un script en Node.js que descarga el modelo `.gguf` directamente a la carpeta `models/` con barra de progreso:

```powershell
node descargar_modelo.js
```

* Por defecto descarga **Llama 3.2 3B Instruct** (~2.0 GB), optimizado para velocidad y portabilidad.
* Si prefieres **Llama 3.1 8B Instruct** (~4.9 GB, mayor precisión académica):
  ```powershell
  node descargar_modelo.js llama-3.1-8b
  ```

*(También puedes colocar manualmente cualquier archivo `.gguf` que descargues de Hugging Face directamente dentro de la carpeta `models/`)*.

---

## 2. Instalar la Dependencia del Motor Local

Ejecuta una sola vez en la terminal del bot:

```powershell
npm install node-llama-cpp
```

Esta librería descarga e integra los binarios precompilados de C++ directamente en tu carpeta `node_modules`, permitiendo aceleración por CPU y GPU sin instalar nada en Windows.

---

## 3. Iniciar el Bot

Simplemente arranca el bot:

```powershell
node src/index.js
```

1. El bot detectará automáticamente el archivo `.gguf` dentro de `models/`.
2. Cargará el modelo a la memoria al iniciar.
3. Mostrará el código QR en pantalla.
4. Escanéalo con tu WhatsApp y ya estará respondiendo de forma 100% local, privada y portable.
