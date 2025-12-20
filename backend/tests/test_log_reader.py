"""
Tests for log_reader module
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from log_reader import parse_syslog_line, get_log_stats


class TestParseSyslogLine:
    """Tests for parse_syslog_line function"""
    
    def test_parse_standard_syslog_line(self):
        """Test parsing a standard syslog format line"""
        line = "Nov 26 12:00:01 host1 systemd[1]: Started Session 1 of user root."
        
        result = parse_syslog_line(line)
        
        assert result is not None
        assert result['timestamp'] == "Nov 26 12:00:01"
        assert result['host'] == "host1"
        assert result['process'] == "systemd"
        assert "Started Session" in result['message']
        assert result['level'] == "INFO"
    
    def test_parse_syslog_line_with_error(self):
        """Test parsing syslog line containing error"""
        line = "Nov 26 12:00:01 host1 kernel: Error: disk full"
        
        result = parse_syslog_line(line)
        
        assert result is not None
        assert result['level'] == "ERROR"
    
    def test_parse_syslog_line_with_warning(self):
        """Test parsing syslog line containing warning"""
        line = "Nov 26 12:00:01 host1 cron: Warning: job delayed"
        
        result = parse_syslog_line(line)
        
        assert result is not None
        assert result['level'] == "WARN"
    
    def test_parse_syslog_line_with_fail(self):
        """Test parsing syslog line containing fail keyword"""
        line = "Nov 26 12:00:01 host1 sshd[1234]: Authentication failed for user admin"
        
        result = parse_syslog_line(line)
        
        assert result is not None
        assert result['level'] == "ERROR"
    
    def test_parse_syslog_line_without_pid(self):
        """Test parsing syslog line without PID"""
        line = "Nov 26 12:00:01 host1 kernel: Device ready"
        
        result = parse_syslog_line(line)
        
        assert result is not None
        assert result['process'] == "kernel"
    
    def test_parse_invalid_line(self):
        """Test parsing an invalid line returns None"""
        line = "This is not a valid syslog line"
        
        result = parse_syslog_line(line)
        
        assert result is None
    
    def test_parse_empty_line(self):
        """Test parsing an empty line returns None"""
        result = parse_syslog_line("")
        
        assert result is None
    
    def test_raw_line_preserved(self):
        """Test that raw line is preserved in result"""
        line = "Nov 26 12:00:01 host1 systemd[1]: Started service"
        
        result = parse_syslog_line(line)
        
        assert result is not None
        assert result['raw'] == line


class TestGetLogStats:
    """Tests for get_log_stats function with mock data"""
    
    def test_stats_empty_logs(self, monkeypatch):
        """Test stats for empty logs"""
        # Mock get_logs to return empty list
        monkeypatch.setattr('log_reader.get_logs', lambda host, limit: [])
        
        stats = get_log_stats("test_host", "1h")
        
        assert stats['total'] == 0
        assert stats['levels'] == {}
        assert stats['time_series'] == []
    
    def test_stats_with_logs(self, monkeypatch):
        """Test stats calculation with logs"""
        mock_logs = [
            {'timestamp': '2025 Dec 20 10:00:00', 'level': 'INFO', 'message': 'Test 1'},
            {'timestamp': '2025 Dec 20 10:00:01', 'level': 'INFO', 'message': 'Test 2'},
            {'timestamp': '2025 Dec 20 10:00:02', 'level': 'ERROR', 'message': 'Error test'},
            {'timestamp': '2025 Dec 20 10:00:03', 'level': 'WARN', 'message': 'Warning test'},
        ]
        
        monkeypatch.setattr('log_reader.get_logs', lambda host, limit: mock_logs)
        
        stats = get_log_stats("test_host", "1h")
        
        assert stats['total'] == 4
        assert 'INFO' in stats['levels']
        assert stats['levels']['INFO'] == 2
        assert stats['levels']['ERROR'] == 1
        assert stats['levels']['WARN'] == 1
    
    def test_stats_time_range_all(self, monkeypatch):
        """Test stats with 'all' time range"""
        mock_logs = [
            {'timestamp': '2025-12-20T10:00:00+09:00', 'level': 'INFO', 'message': 'Test'},
        ]
        
        monkeypatch.setattr('log_reader.get_logs', lambda host, limit: mock_logs)
        
        stats = get_log_stats("test_host", "all")
        
        assert stats['total'] == 1
    
    def test_stats_invalid_timestamp_handling(self, monkeypatch):
        """Test stats handles invalid timestamps gracefully"""
        mock_logs = [
            {'timestamp': 'invalid-timestamp', 'level': 'INFO', 'message': 'Test'},
            {'timestamp': '', 'level': 'ERROR', 'message': 'Error'},
        ]
        
        monkeypatch.setattr('log_reader.get_logs', lambda host, limit: mock_logs)
        
        # Should not raise exception
        stats = get_log_stats("test_host", "1h")
        
        assert stats['total'] == 2
        assert 'levels' in stats
