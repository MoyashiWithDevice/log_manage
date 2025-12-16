import google.generativeai as genai
import os

def analyze_logs(logs):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"error": "API Key missing"}
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
    log_text = "\n".join(logs)
    prompt = f"""
    You are a security expert analyzing system logs.
    Please analyze the following log entries and identify any suspicious activities, errors, or notable patterns.
    Provide a summary of the events and point out if there are any security concerns.
    
    Logs:
    {log_text}
    """
    
    try:
        response = model.generate_content(prompt)
        return {"analysis": response.text}
    except Exception as e:
        return {"error": str(e)}
