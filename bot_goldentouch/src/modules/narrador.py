# narrador.py
import sys
import docx
from gtts import gTTS
import os

def transformar(input_path, output_path):
    try:
        doc = docx.Document(input_path)
        # Unimos párrafos con triple punto para mejorar la pausa de gTTS Python
        texto = "... ".join([p.text for p in doc.paragraphs if p.text.strip()])
        
        if texto:
            tts = gTTS(text=texto, lang='es', slow=False)
            tts.save(output_path)
            print("OK") # Mensaje para que Node sepa que terminó bien
        else:
            print("EMPTY")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    # Recibe argumentos desde Node.js
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    transformar(input_file, output_file)