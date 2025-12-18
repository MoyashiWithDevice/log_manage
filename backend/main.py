from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from log_reader import get_hosts, get_logs, get_log_stats
from analyzer import analyze_logs
from translator import translate_to_japanese
from config_loader import get_config, reload_config
import logging
import uvicorn

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

@app.get("/config/ui")
def get_ui_config():
    """Get UI-related configuration"""
    return {
        "max_logs_to_display": config.get('ui.max_logs_to_display', 500)
    }

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


def load_settings():
    """Load settings from root settings.json"""
    settings_path = Path(__file__).parent.parent / 'settings.json'
    try:
        with open(settings_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"settings.json not found at {settings_path}, using defaults")
        return {"backend": {"host": "0.0.0.0", "port": 8000}}


if __name__ == "__main__":
    # Get server configuration from settings.json
    settings = load_settings()
    host = settings.get('backend', {}).get('host', '0.0.0.0')
    port = settings.get('backend', {}).get('port', 8000)
    reload_enabled = config.get('server.reload', True)
    
    # Display log directory configuration
    log_dirs = config.get_log_directories()
    base_dir = config.get_log_base_dir()
    recursive = config.is_recursive()
    host_detection = config.get_host_detection_strategy()
    include_patterns = config.get_include_patterns()
    exclude_patterns = config.get_exclude_patterns()
    
    logger.info("=" * 60)
    logger.info("Log Directory Configuration:")
    logger.info(f"  Base Directory: {base_dir if base_dir else '(not set)'}")
    logger.info(f"  Log Directories: {log_dirs}")
    logger.info(f"  Recursive Scan: {recursive}")
    logger.info(f"  Host Detection: {host_detection}")
    logger.info(f"  Include Patterns: {include_patterns}")
    logger.info(f"  Exclude Patterns: {exclude_patterns}")
    logger.info("=" * 60)
    
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=reload_enabled)
