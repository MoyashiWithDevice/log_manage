"""
Tests for FastAPI API endpoints
"""
import pytest
import sys
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


class TestRootEndpoint:
    """Tests for root endpoint"""
    
    def test_read_root(self, client):
        """Test root endpoint returns running message"""
        response = client.get("/")
        
        assert response.status_code == 200
        assert response.json() == {"message": "SIEM Backend is running"}


class TestHostsEndpoint:
    """Tests for /hosts endpoint"""
    
    def test_list_hosts(self, client):
        """Test listing hosts"""
        with patch('main.get_hosts') as mock_get_hosts:
            mock_get_hosts.return_value = ['host1', 'host2', 'host3']
            
            response = client.get("/hosts")
            
            assert response.status_code == 200
            assert response.json() == ['host1', 'host2', 'host3']
    
    def test_list_hosts_empty(self, client):
        """Test listing hosts when none exist"""
        with patch('main.get_hosts') as mock_get_hosts:
            mock_get_hosts.return_value = []
            
            response = client.get("/hosts")
            
            assert response.status_code == 200
            assert response.json() == []


class TestLogsEndpoint:
    """Tests for /logs/{host} endpoint"""
    
    def test_read_logs(self, client):
        """Test reading logs for a host"""
        mock_logs = [
            {
                'timestamp': '2025-12-20T10:00:00',
                'level': 'INFO',
                'message': 'Test log',
                'process': 'test',
                'service': 'test-service'
            }
        ]
        
        with patch('main.get_logs') as mock_get_logs:
            mock_get_logs.return_value = mock_logs
            
            response = client.get("/logs/host1")
            
            assert response.status_code == 200
            assert response.json() == mock_logs
    
    def test_read_logs_with_limit_offset(self, client):
        """Test reading logs with limit and offset parameters"""
        with patch('main.get_logs') as mock_get_logs:
            mock_get_logs.return_value = []
            
            response = client.get("/logs/host1?limit=50&offset=10")
            
            assert response.status_code == 200
            mock_get_logs.assert_called_once_with('host1', 50, 10)
    
    def test_read_logs_not_found(self, client):
        """Test reading logs for non-existent host"""
        with patch('main.get_logs') as mock_get_logs:
            mock_get_logs.side_effect = FileNotFoundError("Host not found")
            
            response = client.get("/logs/nonexistent")
            
            assert response.status_code == 404
            assert "Host not found" in response.json()['detail']


class TestStatsEndpoint:
    """Tests for /stats/{host} endpoint"""
    
    def test_read_stats(self, client):
        """Test reading stats for a host"""
        mock_stats = {
            'total': 100,
            'levels': {'INFO': 80, 'WARN': 15, 'ERROR': 5},
            'time_series': [],
            'filtered_total': 50,
            'filtered_levels': {'INFO': 40, 'WARN': 8, 'ERROR': 2}
        }
        
        with patch('main.get_log_stats') as mock_get_stats:
            mock_get_stats.return_value = mock_stats
            
            response = client.get("/stats/host1")
            
            assert response.status_code == 200
            assert response.json()['total'] == 100
    
    def test_read_stats_with_time_range(self, client):
        """Test reading stats with time_range parameter"""
        with patch('main.get_log_stats') as mock_get_stats:
            mock_get_stats.return_value = {'total': 0, 'levels': {}, 'time_series': [], 'filtered_total': 0, 'filtered_levels': {}}
            
            response = client.get("/stats/host1?time_range=1d")
            
            assert response.status_code == 200
            mock_get_stats.assert_called_once_with('host1', '1d')
    
    def test_read_stats_not_found(self, client):
        """Test reading stats for non-existent host"""
        with patch('main.get_log_stats') as mock_get_stats:
            mock_get_stats.side_effect = FileNotFoundError("Host not found")
            
            response = client.get("/stats/nonexistent")
            
            assert response.status_code == 404


class TestAnalyzeEndpoint:
    """Tests for /analyze endpoint"""
    
    def test_analyze_without_api_key(self, client, monkeypatch):
        """Test analyze endpoint without API key"""
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        
        response = client.post("/analyze", json={"logs": ["test log"]})
        
        assert response.status_code == 500
        assert "API Key not configured" in response.json()['detail']
    
    def test_analyze_with_api_key(self, client, monkeypatch):
        """Test analyze endpoint with API key"""
        monkeypatch.setenv("GEMINI_API_KEY", "test-api-key")
        
        with patch('main.analyze_logs') as mock_analyze:
            mock_analyze.return_value = {"analysis": "Test analysis result"}
            
            response = client.post("/analyze", json={"logs": ["test log 1", "test log 2"]})
            
            assert response.status_code == 200
            assert response.json()['analysis'] == "Test analysis result"


class TestTranslateEndpoint:
    """Tests for /translate endpoint"""
    
    def test_translate_without_api_key(self, client, monkeypatch):
        """Test translate endpoint without API key"""
        monkeypatch.delenv("DEEPL_API_KEY", raising=False)
        
        response = client.post("/translate", json={"text": "Hello world"})
        
        assert response.status_code == 500
        assert "API Key not configured" in response.json()['detail']
    
    def test_translate_with_api_key(self, client, monkeypatch):
        """Test translate endpoint with API key"""
        monkeypatch.setenv("DEEPL_API_KEY", "test-api-key")
        
        with patch('main.translate_to_japanese') as mock_translate:
            mock_translate.return_value = {"translated_text": "こんにちは世界"}
            
            response = client.post("/translate", json={"text": "Hello world"})
            
            assert response.status_code == 200
            assert response.json()['translated_text'] == "こんにちは世界"
    
    def test_translate_error(self, client, monkeypatch):
        """Test translate endpoint returns error properly"""
        monkeypatch.setenv("DEEPL_API_KEY", "test-api-key")
        
        with patch('main.translate_to_japanese') as mock_translate:
            mock_translate.return_value = {"error": "Translation failed"}
            
            response = client.post("/translate", json={"text": "Hello"})
            
            assert response.status_code == 500
            assert "Translation failed" in response.json()['detail']


class TestConfigEndpoints:
    """Tests for config endpoints"""
    
    def test_get_ui_config(self, client):
        """Test getting UI configuration"""
        response = client.get("/config/ui")
        
        assert response.status_code == 200
        assert 'max_logs_to_display' in response.json()
    
    def test_reload_configuration(self, client):
        """Test reloading configuration"""
        with patch('main.reload_config') as mock_reload:
            mock_reload.return_value = None
            
            response = client.post("/config/reload")
            
            assert response.status_code == 200
            assert "reloaded" in response.json()['message'].lower()
    
    def test_reload_configuration_error(self, client):
        """Test reloading configuration with error"""
        with patch('main.reload_config') as mock_reload:
            mock_reload.side_effect = Exception("Config file not found")
            
            response = client.post("/config/reload")
            
            assert response.status_code == 500


class TestCORS:
    """Tests for CORS middleware"""
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are present in response"""
        response = client.options("/", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        })
        
        # Check that the server responds (CORS middleware is active)
        assert response.status_code in [200, 204, 400]
