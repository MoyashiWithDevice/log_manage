"""
Tests for config_loader module
"""
import pytest
import os
import tempfile
from pathlib import Path
import yaml
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from config_loader import Config, load_config, load_config_with_env_override


class TestConfig:
    """Tests for Config class"""
    
    def test_config_with_defaults(self):
        """Test Config initialization with default values"""
        config = Config()
        
        # Check default values
        assert config.get('logs.directories') == ['./logs']
        assert config.get('logs.recursive') == False
        assert config.get('server.port') == 8000
        assert config.get('server.host') == '0.0.0.0'
        assert config.get('ai.gemini.model') == 'gemini-2.0-flash-exp'
    
    def test_config_with_custom_values(self, sample_config_dict):
        """Test Config initialization with custom values"""
        sample_config_dict['logs']['directories'] = ['/custom/logs']
        sample_config_dict['server']['port'] = 9000
        
        config = Config(sample_config_dict)
        
        assert config.get('logs.directories') == ['/custom/logs']
        assert config.get('server.port') == 9000
    
    def test_config_get_with_dot_notation(self, sample_config_dict):
        """Test get method with dot notation"""
        config = Config(sample_config_dict)
        
        assert config.get('logs.host_detection') == 'filename'
        assert config.get('server.cors.enabled') == True
        assert config.get('ai.gemini.max_tokens') == 2048
    
    def test_config_get_with_default_value(self):
        """Test get method returns default for missing keys"""
        config = Config()
        
        assert config.get('nonexistent.key', 'default') == 'default'
        assert config.get('logs.nonexistent', 42) == 42
    
    def test_get_log_directories(self, sample_config_dict):
        """Test get_log_directories method"""
        config = Config(sample_config_dict)
        
        dirs = config.get_log_directories()
        assert isinstance(dirs, list)
        assert './logs' in dirs
    
    def test_is_recursive(self, sample_config_dict):
        """Test is_recursive method"""
        config = Config(sample_config_dict)
        assert config.is_recursive() == False
        
        sample_config_dict['logs']['recursive'] = True
        config2 = Config(sample_config_dict)
        assert config2.is_recursive() == True
    
    def test_get_include_patterns(self, sample_config_dict):
        """Test get_include_patterns method"""
        config = Config(sample_config_dict)
        
        patterns = config.get_include_patterns()
        assert '*' in patterns
    
    def test_get_exclude_patterns(self, sample_config_dict):
        """Test get_exclude_patterns method"""
        config = Config(sample_config_dict)
        
        patterns = config.get_exclude_patterns()
        assert '*.gz' in patterns
        assert '*.zip' in patterns
    
    def test_get_host_detection_strategy(self, sample_config_dict):
        """Test get_host_detection_strategy method"""
        config = Config(sample_config_dict)
        
        assert config.get_host_detection_strategy() == 'filename'
    
    def test_get_cors_origins(self, sample_config_dict):
        """Test get_cors_origins method"""
        config = Config(sample_config_dict)
        
        origins = config.get_cors_origins()
        assert 'http://localhost:5173' in origins
    
    def test_config_validates_port(self):
        """Test that invalid port numbers are corrected"""
        config_dict = {
            'server': {
                'port': 99999  # Invalid port
            }
        }
        config = Config(config_dict)
        assert config.get_server_port() == 8000  # Should default to 8000
    
    def test_config_validates_host_detection(self):
        """Test that invalid host detection strategy is corrected"""
        config_dict = {
            'logs': {
                'host_detection': 'invalid_strategy'
            }
        }
        config = Config(config_dict)
        assert config.get_host_detection_strategy() == 'filename'


class TestLoadConfig:
    """Tests for load_config function"""
    
    def test_load_config_from_file(self, temp_config_file):
        """Test loading config from a file"""
        config = load_config(temp_config_file)
        
        assert isinstance(config, Config)
        assert config.get('logs.directories') == ['./logs']
    
    def test_load_config_missing_file(self):
        """Test loading config when file doesn't exist"""
        config = load_config('/nonexistent/path/config.yaml')
        
        # Should return Config with defaults
        assert isinstance(config, Config)
        assert config.get('logs.directories') == ['./logs']
    
    def test_load_config_invalid_yaml(self):
        """Test loading config with invalid YAML"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write("invalid: yaml: content: [")
            temp_path = f.name
        
        try:
            config = load_config(temp_path)
            # Should return Config with defaults on error
            assert isinstance(config, Config)
        finally:
            os.unlink(temp_path)


class TestLoadConfigWithEnvOverride:
    """Tests for load_config_with_env_override function"""
    
    def test_env_override_log_directories(self, temp_config_file, mock_env_vars):
        """Test LOG_DIRECTORIES environment variable override"""
        mock_env_vars(LOG_DIRECTORIES='/var/log,/tmp/logs')
        
        config = load_config_with_env_override(temp_config_file)
        
        dirs = config.get_log_directories()
        assert '/var/log' in dirs
        assert '/tmp/logs' in dirs
    
    def test_env_override_recursive(self, temp_config_file, mock_env_vars):
        """Test LOG_RECURSIVE environment variable override"""
        mock_env_vars(LOG_RECURSIVE='true')
        
        config = load_config_with_env_override(temp_config_file)
        
        assert config.is_recursive() == True
    
    def test_env_override_server_port(self, temp_config_file, mock_env_vars):
        """Test SERVER_PORT environment variable override"""
        mock_env_vars(SERVER_PORT='9000')
        
        config = load_config_with_env_override(temp_config_file)
        
        assert config.get_server_port() == 9000
    
    def test_env_override_invalid_port(self, temp_config_file, mock_env_vars):
        """Test invalid SERVER_PORT environment variable"""
        mock_env_vars(SERVER_PORT='invalid')
        
        # Should not crash and keep default
        config = load_config_with_env_override(temp_config_file)
        assert isinstance(config, Config)
    
    def test_env_override_base_dir(self, temp_config_file, mock_env_vars, temp_log_dir):
        """Test LOG_BASE_DIR environment variable override"""
        mock_env_vars(LOG_BASE_DIR=temp_log_dir)
        
        config = load_config_with_env_override(temp_config_file)
        
        # base_dir should enable recursive and directory detection
        assert config.is_recursive() == True
        assert config.get_host_detection_strategy() == 'directory'
