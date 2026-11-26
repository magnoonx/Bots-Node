# narrador.py
import sys
import docx
import os
import subprocess

def hablar_offline(texto, output_path):
    """
    Intenta sintetizar voz de forma 100% offline usando motores locales.
    """
    # 1. Intentar con pyttsx3 si está instalado
    try:
        import pyttsx3
        engine = pyttsx3.init()
        # Seleccionar voz en español si está disponible
        for voice in engine.getProperty('voices'):
            if 'es' in voice.id.lower() or 'spanish' in voice.name.lower() or 'sabina' in voice.name.lower() or 'helena' in voice.name.lower():
                engine.setProperty('voice', voice.id)
                break
        engine.save_to_file(texto, output_path)
        engine.runAndWait()
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return True
    except Exception:
        pass

    # 2. Intentar en Windows con SAPI5 / win32com si está disponible
    try:
        import win32com.client
        speaker = win32com.client.Dispatch("SAPI.SpVoice")
        filestream = win32com.client.Dispatch("SAPI.SpFileStream")
        # 3 = SSFMCreateForWrite
        filestream.Open(output_path, 3, False)
        speaker.AudioOutputStream = filestream
        speaker.Speak(texto)
        filestream.Close()
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return True
    except Exception:
        pass

    # 3. Intentar con System.Speech nativo de Windows (sin librerías externas)
    if os.name == 'nt':
        try:
            # Archivo temporal para el script powershell seguro
            clean_text = texto.replace('"', '`"').replace("'", "''")
            ps_script = f"""
            Add-Type -AssemblyName System.Speech;
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
            $voices = $synth.GetInstalledVoices();
            foreach ($v in $voices) {{
                if ($v.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'es') {{
                    $synth.SelectVoice($v.VoiceInfo.Name);
                    break;
                }}
            }}
            $synth.SetOutputToWaveFile('{output_path}');
            $synth.Speak("{clean_text}");
            $synth.Dispose();
            """
            res = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_script], capture_output=True, timeout=30)
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                return True
        except Exception:
            pass

    return False

def transformar(input_path, output_path):
    try:
        if not os.path.exists(input_path):
            print("ERROR: Archivo no encontrado")
            return

        doc = docx.Document(input_path)
        texto = ". ".join([p.text.strip() for p in doc.paragraphs if p.text.strip()])
        
        if not texto:
            print("EMPTY")
            return

        # 1. Intentar primero con motor 100% LOCAL (Offline)
        if hablar_offline(texto, output_path):
            print("OK")
            return

        # 2. Fallback a gTTS si los motores offline no están disponibles
        try:
            from gtts import gTTS
            tts = gTTS(text=texto, lang='es', slow=False)
            tts.save(output_path)
            print("OK")
            return
        except Exception as e_gtts:
            print(f"ERROR_TTS: {e_gtts}")

    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("ERROR: Parámetros insuficientes")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    transformar(input_file, output_file)
