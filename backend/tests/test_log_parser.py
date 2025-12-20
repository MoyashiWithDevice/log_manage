"""
Tests for log_parser module
"""
import pytest
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from log_parser import LogParser
from config_loader import Config


class TestLogParserPatterns:
    """Tests for log parsing patterns"""
    
    @pytest.fixture
    def parser(self, sample_config_dict):
        """Create LogParser instance"""
        config = Config(sample_config_dict)
        return LogParser(config)
    
    def test_syslog_pattern_match(self, parser):
        """Test traditional syslog format parsing"""
        line = "Nov 26 12:00:01 host1 systemd[1]: Started Session 1 of user root."
        
        match = parser.syslog_pattern.match(line)
        assert match is not None
        
        timestamp, host, process_raw, message = match.groups()
        assert timestamp == "Nov 26 12:00:01"
        assert host == "host1"
        assert "systemd" in process_raw
        assert "Started Session" in message
    
    def test_iso8601_syslog_pattern_match(self, parser):
        """Test ISO 8601 syslog format parsing"""
        line = "2025-12-17T16:13:08+00:00 RHEL-FRONT tailscaled[926]: netcheck: UDP is blocked"
        
        match = parser.iso8601_syslog_pattern.match(line)
        assert match is not None
        
        timestamp, host, process, pid, message = match.groups()
        assert timestamp == "2025-12-17T16:13:08+00:00"
        assert host == "RHEL-FRONT"
        assert process == "tailscaled"
        assert pid == "926"
        assert "UDP is blocked" in message
    
    def test_keyvalue_pattern_match(self, parser):
        """Test key-value format parsing"""
        line = "2025-12-17T23:00:19.900707+09:00 host=LOGS app=rsyslogd pid=- msg= rsyslogd's groupid changed"
        
        match = parser.keyvalue_pattern.match(line)
        assert match is not None
        
        timestamp, host, process, pid, message = match.groups()
        assert "2025-12-17T23:00:19" in timestamp
        assert host == "LOGS"
        assert process == "rsyslogd"
        assert pid == "-"
        assert "groupid changed" in message


class TestParseProcessAndLevel:
    """Tests for _parse_process_and_level method"""
    
    @pytest.fixture
    def parser(self, sample_config_dict):
        config = Config(sample_config_dict)
        return LogParser(config)
    
    def test_parse_process_with_pid(self, parser):
        """Test parsing process with PID in brackets"""
        process, pid, level = parser._parse_process_and_level("systemd[1]", "Started service")
        
        assert process == "systemd"
        assert pid == "1"
        assert level == "INFO"
    
    def test_parse_process_with_level(self, parser):
        """Test parsing process with level in brackets"""
        process, pid, level = parser._parse_process_and_level("cron[WARN]", "Job delayed")
        
        assert process == "cron"
        assert pid is None
        assert level == "WARN"
    
    def test_parse_process_error_from_message(self, parser):
        """Test error level detection from message content"""
        process, pid, level = parser._parse_process_and_level("kernel", "Error: disk full")
        
        assert process == "kernel"
        assert level == "ERROR"
    
    def test_parse_process_warn_from_message(self, parser):
        """Test warning level detection from message content"""
        process, pid, level = parser._parse_process_and_level("app", "Warning: high memory usage")
        
        assert level == "WARN"
    
    def test_parse_process_fail_keyword(self, parser):
        """Test error level detection from 'fail' keyword"""
        process, pid, level = parser._parse_process_and_level("sshd", "Authentication failed")
        
        assert level == "ERROR"


class TestParseLogFile:
    """Tests for parse_log_file method"""
    
    @pytest.fixture
    def parser_with_dir(self, temp_log_dir, sample_config_dict):
        """Create LogParser with temp directory"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        return LogParser(config), temp_log_dir
    
    def test_parse_syslog_file(self, parser_with_dir):
        """Test parsing syslog format file"""
        parser, temp_dir = parser_with_dir
        file_path = Path(temp_dir) / "syslog"
        
        logs = parser.parse_log_file(file_path)
        
        assert len(logs) > 0
        assert all('timestamp' in log for log in logs)
        assert all('level' in log for log in logs)
        assert all('message' in log for log in logs)
        
        # Check levels are detected correctly
        error_logs = [log for log in logs if log['level'] == 'ERROR']
        assert len(error_logs) > 0  # Should find the "Error: disk full" line
    
    def test_parse_iso8601_file(self, parser_with_dir):
        """Test parsing ISO 8601 format file"""
        parser, temp_dir = parser_with_dir
        file_path = Path(temp_dir) / "messages"
        
        logs = parser.parse_log_file(file_path)
        
        assert len(logs) > 0
        
        # Check host is extracted from log line
        rhel_logs = [log for log in logs if log.get('host') == 'RHEL-FRONT']
        assert len(rhel_logs) > 0
    
    def test_parse_keyvalue_file(self, parser_with_dir):
        """Test parsing key-value format file"""
        parser, temp_dir = parser_with_dir
        file_path = Path(temp_dir) / "keyvalue.log"
        
        logs = parser.parse_log_file(file_path)
        
        assert len(logs) > 0
        
        # Check host is extracted from key-value format
        logs_host = [log for log in logs if log.get('host') == 'LOGS']
        assert len(logs_host) > 0
    
    def test_parse_nonexistent_file(self, parser_with_dir):
        """Test parsing non-existent file"""
        parser, temp_dir = parser_with_dir
        file_path = Path(temp_dir) / "nonexistent.log"
        
        logs = parser.parse_log_file(file_path)
        
        assert logs == []


class TestFindLogFiles:
    """Tests for find_log_files method"""
    
    def test_find_files_in_directory(self, temp_log_dir, sample_config_dict):
        """Test finding log files in a directory"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        log_files = parser.find_log_files()
        
        # Should find all log files
        all_files = []
        for host_files in log_files.values():
            all_files.extend(host_files)
        
        assert len(all_files) >= 3  # syslog, messages, keyvalue.log
    
    def test_exclude_patterns(self, temp_log_dir, sample_config_dict):
        """Test that exclude patterns work"""
        # Create a .gz file that should be excluded
        gz_path = Path(temp_log_dir) / "archive.log.gz"
        gz_path.write_text("compressed data")
        
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        sample_config_dict['logs']['exclude_patterns'] = ['*.gz']
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        log_files = parser.find_log_files()
        
        # Should not include the .gz file
        all_files = []
        for host_files in log_files.values():
            all_files.extend(host_files)
        
        gz_files = [f for f in all_files if str(f).endswith('.gz')]
        assert len(gz_files) == 0
    
    def test_recursive_scan(self, temp_log_dir_with_hosts, sample_config_dict):
        """Test recursive directory scanning"""
        sample_config_dict['logs']['directories'] = [temp_log_dir_with_hosts]
        sample_config_dict['logs']['recursive'] = True
        sample_config_dict['logs']['host_detection'] = 'directory'
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        log_files = parser.find_log_files()
        
        # Should find files in subdirectories with host names
        assert 'host1' in log_files or 'host2' in log_files


class TestGetHostName:
    """Tests for _get_host_name method"""
    
    def test_filename_strategy(self, sample_config_dict):
        """Test filename host detection strategy"""
        sample_config_dict['logs']['host_detection'] = 'filename'
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        file_path = Path("/var/log/server1.log")
        base_dir = Path("/var/log")
        
        host = parser._get_host_name(file_path, base_dir)
        assert host == "server1"
    
    def test_directory_strategy(self, sample_config_dict):
        """Test directory host detection strategy"""
        sample_config_dict['logs']['host_detection'] = 'directory'
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        file_path = Path("/var/log/myhost/syslog")
        base_dir = Path("/var/log")
        
        host = parser._get_host_name(file_path, base_dir)
        assert host == "myhost"
    
    def test_auto_strategy_direct_file(self, sample_config_dict):
        """Test auto strategy for file directly in base dir"""
        sample_config_dict['logs']['host_detection'] = 'auto'
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        file_path = Path("/var/log/syslog")
        base_dir = Path("/var/log")
        
        host = parser._get_host_name(file_path, base_dir)
        assert host == "syslog"  # Should use filename
    
    def test_auto_strategy_nested_file(self, sample_config_dict):
        """Test auto strategy for file in subdirectory"""
        sample_config_dict['logs']['host_detection'] = 'auto'
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        file_path = Path("/var/log/remote/myhost/syslog")
        base_dir = Path("/var/log/remote")
        
        host = parser._get_host_name(file_path, base_dir)
        assert host == "myhost"  # Should use parent directory


class TestGetLogsForHost:
    """Tests for get_logs_for_host method"""
    
    def test_get_logs_for_existing_host(self, temp_log_dir, sample_config_dict):
        """Test getting logs for an existing host"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        # Find available hosts first
        hosts = parser.get_all_hosts()
        if hosts:
            logs = parser.get_logs_for_host(hosts[0], limit=10)
            assert isinstance(logs, list)
    
    def test_get_logs_for_nonexistent_host(self, temp_log_dir, sample_config_dict):
        """Test getting logs for a non-existent host"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        logs = parser.get_logs_for_host("nonexistent_host", limit=10)
        assert logs == []
    
    def test_get_logs_pagination(self, temp_log_dir, sample_config_dict):
        """Test logs pagination with limit and offset"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        hosts = parser.get_all_hosts()
        if hosts:
            # Get first 2 logs
            logs_page1 = parser.get_logs_for_host(hosts[0], limit=2, offset=0)
            # Get next 2 logs
            logs_page2 = parser.get_logs_for_host(hosts[0], limit=2, offset=2)
            
            # Pages should be different if there are enough logs
            if len(logs_page1) == 2 and len(logs_page2) > 0:
                assert logs_page1 != logs_page2


class TestGetAllHosts:
    """Tests for get_all_hosts method"""
    
    def test_get_all_hosts(self, temp_log_dir, sample_config_dict):
        """Test getting all available hosts"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        hosts = parser.get_all_hosts()
        
        assert isinstance(hosts, list)
        # Should have hosts from the log files
        assert len(hosts) > 0
    
    def test_get_all_hosts_empty_directory(self, sample_config_dict):
        """Test getting hosts from empty directory"""
        with tempfile.TemporaryDirectory() as empty_dir:
            sample_config_dict['logs']['directories'] = [empty_dir]
            config = Config(sample_config_dict)
            parser = LogParser(config)
            
            hosts = parser.get_all_hosts()
            
            assert hosts == []


class TestGetStatsForHost:
    """Tests for get_stats_for_host method"""
    
    def test_get_stats_for_host(self, temp_log_dir, sample_config_dict):
        """Test getting stats for a host"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        hosts = parser.get_all_hosts()
        if hosts:
            stats = parser.get_stats_for_host(hosts[0])
            
            assert 'total' in stats
            assert 'info' in stats
            assert 'warn' in stats
            assert 'error' in stats
            assert stats['total'] >= 0
    
    def test_get_stats_for_nonexistent_host(self, temp_log_dir, sample_config_dict):
        """Test getting stats for non-existent host"""
        sample_config_dict['logs']['directories'] = [temp_log_dir]
        config = Config(sample_config_dict)
        parser = LogParser(config)
        
        stats = parser.get_stats_for_host("nonexistent_host")
        
        assert stats['total'] == 0
        assert stats['info'] == 0
        assert stats['warn'] == 0
        assert stats['error'] == 0
