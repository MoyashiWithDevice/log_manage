import deepl
import os

def translate_to_japanese(text):
    """Translate text to Japanese using DeepL API"""
    api_key = os.getenv("DEEPL_API_KEY")
    if not api_key:
        return {"error": "DeepL API Key missing"}
    
    try:
        translator = deepl.Translator(api_key)
        result = translator.translate_text(text, target_lang="JA")
        return {"translated_text": result.text}
    except Exception as e:
        return {"error": str(e)}
