"""
Pytest fixtures for SIEM Log Management System tests
"""
import pytest
import tempfile
import os
from pathlib import Path
import sys

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def temp_log_dir():
    """Create a temporary directory with sample log files"""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create sample syslog format log file
        syslog_content = """Nov 26 12:00:01 host1 systemd[1]: Started Session 1 of user root.
Nov 26 12:00:02 host1 sshd[1234]: Accepted publickey for user from 192.168.1.1
Nov 26 12:00:03 host1 kernel: [12345.678901] Error: disk full
Nov 26 12:00:04 host1 cron[5678]: Warning: job delayed"""
        
        syslog_path = Path(tmpdir) / "syslog"
        syslog_path.write_text(syslog_content)
        
        # Create ISO 8601 format log file
        iso_content = """2025-12-17T16:13:08+00:00 RHEL-FRONT tailscaled[926]: netcheck: UDP is blocked, trying HTTPS
2025-12-17T16:13:09+00:00 RHEL-FRONT tailscaled[926]: Error connecting to server
2025-12-17T16:13:10+00:00 RHEL-FRONT tailscaled[926]: Warning: connection slow"""
        
        iso_path = Path(tmpdir) / "messages"
        iso_path.write_text(iso_content)
        
        # Create key-value format log file
        kv_content = """2025-12-17T23:00:19.900707+09:00 host=LOGS app=rsyslogd pid=- msg= rsyslogd's groupid changed to 104
2025-12-17T23:00:20.123456+09:00 host=LOGS app=sshd pid=1234 msg= Connection established
2025-12-17T23:00:21.234567+09:00 host=LOGS app=nginx pid=5678 msg= Error 502 bad gateway"""
        
        kv_path = Path(tmpdir) / "keyvalue.log"
        kv_path.write_text(kv_content)
        
        yield tmpdir


@pytest.fixture
def temp_log_dir_with_hosts():
    """Create a temporary directory with host subdirectories"""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create host1 directory
        host1_dir = Path(tmpdir) / "host1"
        host1_dir.mkdir()
        
        host1_log = host1_dir / "syslog"
        host1_log.write_text("""Nov 26 12:00:01 host1 systemd[1]: Started Session 1 of user root.
Nov 26 12:00:02 host1 sshd[1234]: Error: authentication failed""")
        
        # Create host2 directory
        host2_dir = Path(tmpdir) / "host2"
        host2_dir.mkdir()
        
        host2_log = host2_dir / "syslog"
        host2_log.write_text("""Nov 26 12:00:01 host2 nginx[999]: Started web server
Nov 26 12:00:02 host2 nginx[999]: Warning: high load detected""")
        
        yield tmpdir


@pytest.fixture
def sample_config_dict():
    """Sample configuration dictionary"""
    return {
        'logs': {
            'base_dir': '',
            'directories': ['./logs'],
            'recursive': False,
            'include_patterns': ['*'],
            'exclude_patterns': ['*.gz', '*.zip'],
            'max_file_size_mb': 100,
            'host_detection': 'filename'
        },
        'server': {
            'host': '0.0.0.0',
            'port': 8000,
            'reload': True,
            'cors': {
                'enabled': True,
                'origins': ['http://localhost:5173']
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
        'logging': {
            'level': 'INFO',
            'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        }
    }


@pytest.fixture
def temp_config_file(sample_config_dict):
    """Create a temporary config file"""
    import yaml
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "config.yaml"
        with open(config_path, 'w') as f:
            yaml.dump(sample_config_dict, f)
        yield str(config_path)


@pytest.fixture
def mock_env_vars():
    """Context manager for mocking environment variables"""
    original_env = os.environ.copy()
    
    def set_env(**kwargs):
        for key, value in kwargs.items():
            os.environ[key] = value
    
    def cleanup():
        os.environ.clear()
        os.environ.update(original_env)
    
    yield set_env
    cleanup()
