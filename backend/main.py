from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
from log_reader import get_hosts, get_logs, get_log_stats
from analyzer import analyze_logs
from translator import translate_to_japanese
from config_loader import get_config, reload_config
import logging

load_dotenv()

# Load configuration
config = get_config()

# Setup logging
logging.basicConfig(
    level=config.get('logging.level', 'INFO'),
    format=config.get('logging.format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Use CORS origins from config
cors_origins = config.get_cors_origins() if config.get('server.cors.enabled', True) else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LogEntry(BaseModel):
    timestamp: str
    host: str
    service: str
    process: str
    message: str
    level: str

class AnalysisRequest(BaseModel):
    logs: List[str]

class TranslationRequest(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"message": "SIEM Backend is running"}

@app.get("/hosts")
def list_hosts():
    return get_hosts()

@app.get("/logs/{host}")
def read_logs(host: str, limit: int = 100):
    try:
        return get_logs(host, limit)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Host not found")

@app.get("/stats/{host}")
def read_stats(host: str, time_range: str = "1h"):
    try:
        return get_log_stats(host, time_range)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Host not found")

@app.post("/analyze")
def analyze_log_entries(request: AnalysisRequest):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    return analyze_logs(request.logs)

@app.post("/translate")
def translate_text(request: TranslationRequest):
    if not os.getenv("DEEPL_API_KEY"):
        raise HTTPException(status_code=500, detail="DeepL API Key not configured")
    result = translate_to_japanese(request.text)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.post("/config/reload")
def reload_configuration():
    """Reload configuration from file"""
    try:
        reload_config()
        logger.info("Configuration reloaded successfully")
        return {"message": "Configuration reloaded successfully"}
    except Exception as e:
        logger.error(f"Error reloading configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Error reloading configuration: {str(e)}")
