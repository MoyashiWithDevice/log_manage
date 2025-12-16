"""
Configuration loader for SIEM Log Management System
"""
import yaml
import os
from pathlib import Path
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class Config:
    """Configuration class with default values and validation"""
    
    def __init__(self, config_dict: Dict[str, Any] = None):
        """Initialize configuration with optional config dictionary"""
        self.config = config_dict or {}
        self._apply_defaults()
        self._validate()
    
    def _apply_defaults(self):
        """Apply default values for missing configuration"""
        defaults = {
            'logs': {
                'directories': ['./logs'],
                'recursive': False,
                'include_patterns': ['*.log', '*.txt'],
                'exclude_patterns': ['*.gz', '*.zip', '*backup*', '*.bak'],
                'max_file_size_mb': 100,
                'host_detection': 'filename'
            },
            'server': {
                'host': '0.0.0.0',
                'port': 8000,
                'reload': True,
                'cors': {
                    'enabled': True,
                    'origins': ['http://localhost:5173', 'http://localhost:3000']
                }
            },
            'ai': {
                'gemini': {
                    'model': 'gemini-2.0-flash-exp',
                    'max_tokens': 2048,
                    'temperature': 0.7
                },
                'max_logs_to_analyze': 50
            },
            'translation': {
                'deepl': {
                    'target_lang': 'JA',
                    'formality': 'default'
                }
            },
            'logging': {
                'level': 'INFO',
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            }
        }
        
        # Merge defaults with provided config
        self.config = self._deep_merge(defaults, self.config)
    
    def _deep_merge(self, default: Dict, override: Dict) -> Dict:
        """Deep merge two dictionaries"""
        result = default.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result
    
    def _validate(self):
        """Validate configuration values"""
        # Validate log directories exist or can be created
        log_dirs = self.get('logs.directories', [])
        if not isinstance(log_dirs, list):
            log_dirs = [log_dirs]
        
        for log_dir in log_dirs:
            path = Path(log_dir)
            if not path.exists():
                logger.warning(f"Log directory does not exist: {log_dir}")
        
        # Validate host detection strategy
        valid_strategies = ['filename', 'directory', 'auto']
        strategy = self.get('logs.host_detection', 'filename')
        if strategy not in valid_strategies:
            logger.warning(f"Invalid host_detection strategy: {strategy}. Using 'filename'")
            self.config['logs']['host_detection'] = 'filename'
        
        # Validate port number
        port = self.get('server.port', 8000)
        if not isinstance(port, int) or port < 1 or port > 65535:
            logger.warning(f"Invalid port number: {port}. Using 8000")
            self.config['server']['port'] = 8000
    
    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get configuration value using dot notation
        Example: config.get('logs.directories')
        """
        keys = key_path.split('.')
        value = self.config
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        
        return value
    
    def get_log_directories(self) -> List[str]:
        """Get list of log directories"""
        dirs = self.get('logs.directories', ['./logs'])
        if not isinstance(dirs, list):
            dirs = [dirs]
        return dirs
    
    def is_recursive(self) -> bool:
        """Check if recursive scanning is enabled"""
        return self.get('logs.recursive', False)
    
    def get_include_patterns(self) -> List[str]:
        """Get file include patterns"""
        return self.get('logs.include_patterns', ['*.log', '*.txt'])
    
    def get_exclude_patterns(self) -> List[str]:
        """Get file exclude patterns"""
        return self.get('logs.exclude_patterns', ['*.gz', '*.zip', '*backup*'])
    
    def get_max_file_size_mb(self) -> int:
        """Get maximum file size in MB"""
        return self.get('logs.max_file_size_mb', 100)
    
    def get_host_detection_strategy(self) -> str:
        """Get host detection strategy"""
        return self.get('logs.host_detection', 'filename')
    
    def get_server_host(self) -> str:
        """Get server host"""
        return self.get('server.host', '0.0.0.0')
    
    def get_server_port(self) -> int:
        """Get server port"""
        return self.get('server.port', 8000)
    
    def get_cors_origins(self) -> List[str]:
        """Get CORS allowed origins"""
        return self.get('server.cors.origins', ['http://localhost:5173'])
    
    def get_gemini_model(self) -> str:
        """Get Gemini model name"""
        return self.get('ai.gemini.model', 'gemini-2.0-flash-exp')
    
    def get_max_logs_to_analyze(self) -> int:
        """Get maximum number of logs to analyze"""
        return self.get('ai.max_logs_to_analyze', 50)


def load_config(config_path: str = None) -> Config:
    """
    Load configuration from YAML file
    
    Args:
        config_path: Path to config file. If None, looks for config.yaml in current directory
    
    Returns:
        Config object
    """
    if config_path is None:
        # Look for config.yaml in the same directory as this script
        config_path = Path(__file__).parent / 'config.yaml'
    
    config_path = Path(config_path)
    
    if not config_path.exists():
        logger.warning(f"Config file not found: {config_path}. Using defaults.")
        return Config()
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config_dict = yaml.safe_load(f)
        
        logger.info(f"Loaded configuration from: {config_path}")
        return Config(config_dict)
    
    except Exception as e:
        logger.error(f"Error loading config file: {e}. Using defaults.")
        return Config()


def load_config_with_env_override(config_path: str = None) -> Config:
    """
    Load configuration and override with environment variables
    
    Environment variables:
    - LOG_DIRECTORIES: Comma-separated list of log directories
    - LOG_RECURSIVE: true/false for recursive scanning
    - SERVER_PORT: Server port number
    - GEMINI_MODEL: Gemini model name
    
    Args:
        config_path: Path to config file
    
    Returns:
        Config object with environment overrides
    """
    config = load_config(config_path)
    
    # Override with environment variables
    if 'LOG_DIRECTORIES' in os.environ:
        dirs = os.environ['LOG_DIRECTORIES'].split(',')
        config.config['logs']['directories'] = [d.strip() for d in dirs]
    
    if 'LOG_RECURSIVE' in os.environ:
        config.config['logs']['recursive'] = os.environ['LOG_RECURSIVE'].lower() == 'true'
    
    if 'SERVER_PORT' in os.environ:
        try:
            config.config['server']['port'] = int(os.environ['SERVER_PORT'])
        except ValueError:
            logger.warning(f"Invalid SERVER_PORT environment variable: {os.environ['SERVER_PORT']}")
    
    if 'GEMINI_MODEL' in os.environ:
        config.config['ai']['gemini']['model'] = os.environ['GEMINI_MODEL']
    
    return config


# Global config instance
_config: Config = None


def get_config() -> Config:
    """Get global config instance"""
    global _config
    if _config is None:
        _config = load_config_with_env_override()
    return _config


def reload_config(config_path: str = None):
    """Reload configuration from file"""
    global _config
    _config = load_config_with_env_override(config_path)
    logger.info("Configuration reloaded")
