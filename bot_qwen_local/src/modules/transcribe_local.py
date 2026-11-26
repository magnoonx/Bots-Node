# transcribe_local.py
import sys
import os

def transcribir_local(audio_path):
    models_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'whisper')
    os.makedirs(models_dir, exist_ok=True)
    model_size = os.getenv("LOCAL_WHISPER_MODEL", "base")

    # 1. Intentar con faster-whisper (Rápido, ligero, decodifica OGG/Opus nativamente sin ffmpeg externo)
    try:
        from faster_whisper import WhisperModel
        # compute_type="int8" para máxima velocidad y bajo consumo en CPU
        model = WhisperModel(model_size, device="cpu", compute_type="int8", download_root=models_dir)
        segments, info = model.transcribe(audio_path, language="es", beam_size=5)
        texto = " ".join([seg.text for seg in segments]).strip()
        if texto:
            print(f"TRANSCRIPCION:{texto}")
            return
        else:
            print("ERROR: Audio procesado pero no se detectaron palabras.")
            return
    except ImportError:
        pass
    except Exception as e:
        print(f"ERROR_FASTER_WHISPER: {e}")

    # 2. Intentar con openai-whisper estándar
    try:
        import whisper
        model = whisper.load_model(model_size, download_root=models_dir)
        res = model.transcribe(audio_path, language="es")
        texto = (res.get("text") or "").strip()
        if texto:
            print(f"TRANSCRIPCION:{texto}")
            return
        else:
            print("ERROR: Audio procesado pero no se detectaron palabras.")
            return
    except ImportError:
        pass
    except Exception as e:
        print(f"ERROR_OPENAI_WHISPER: {e}")

    print("ERROR: Falta instalar 'faster-whisper' en el entorno de Python (.gTTS). Ejecuta: .\\.gTTS\\Scripts\\pip.exe install faster-whisper")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ERROR: Debe especificar la ruta del archivo de audio.")
        sys.exit(1)

    transcribir_local(sys.argv[1])
