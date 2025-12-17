"""
Log parser with configuration support for SIEM Log Management System
Supports multiple directories, recursive scanning, and file pattern matching
"""
import os
import re
from pathlib import Path
from typing import List, Dict, Any
import fnmatch
import logging

logger = logging.getLogger(__name__)


class LogParser:
    """Parse log files based on configuration"""
    
    def __init__(self, config):
        """
        Initialize log parser with configuration
        
        Args:
            config: Config object from config_loader
        """
        self.config = config
        # Regex for Syslog format: Nov 26 12:00:01 host1 process[pid]: message
        self.syslog_pattern = re.compile(
            r'^([A-Z][a-z]{2}\s+\d+\s\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:]+):\s+(.+)$'
        )
        # Regex for ISO 8601 syslog format: 2025-12-17T16:13:08+00:00 RHEL-FRONT tailscaled[926]: message
        self.iso8601_syslog_pattern = re.compile(
            r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+(.+)$'
        )
        # Regex for key-value format: 2025-12-17T23:00:19.900707+09:00 host=LOGS app=rsyslogd pid=- msg= message
        self.keyvalue_pattern = re.compile(
            r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2})\s+host=(\S+)\s+app=(\S+)\s+pid=(\S+)\s+msg=\s*(.*)$'
        )
        # Regex for ISO format (fallback)
        self.iso_pattern = re.compile(
            r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(INFO|WARN|ERROR|DEBUG)\s+(\S+):\s+(.+)'
        )
    
    def _parse_process_and_level(self, process_str, message):
        """
        Parse process string to extract name, pid and level
        Example: "cron[WARN]" -> process="cron", level="WARN"
        Example: "systemd[1]" -> process="systemd", level="INFO"
        """
        process = process_str
        pid = None
        level = "INFO"
        
        # Check for PID or Level in brackets
        match = re.match(r'^(.*?)\[(.*?)\]$', process_str)
        if match:
            process = match.group(1)
            content = match.group(2)
            
            if content.isdigit():
                pid = content
            elif content in ['INFO', 'WARN', 'ERROR', 'DEBUG']:
                level = content
        
        # If level not found in process, check message
        if level == "INFO":
            if "error" in message.lower() or "fail" in message.lower():
                level = "ERROR"
            elif "warn" in message.lower():
                level = "WARN"
                
        return process, pid, level

    def find_log_files(self) -> Dict[str, List[Path]]:
        """
        Find all log files based on configuration
        
        Returns:
            Dictionary mapping host names to list of log file paths
        """
        log_files = {}
        directories = self.config.get_log_directories()
        recursive = self.config.is_recursive()
        include_patterns = self.config.get_include_patterns()
        exclude_patterns = self.config.get_exclude_patterns()
        max_size_mb = self.config.get_max_file_size_mb()
        max_size_bytes = max_size_mb * 1024 * 1024
        host_detection = self.config.get_host_detection_strategy()
        
        for directory in directories:
            dir_path = Path(directory)
            
            if not dir_path.exists():
                logger.warning(f"Directory does not exist: {directory}")
                continue
            
            # Find files
            if recursive:
                pattern = '**/*'
            else:
                pattern = '*'
            
            for file_path in dir_path.glob(pattern):
                if not file_path.is_file():
                    continue
                
                # Check file size
                try:
                    if file_path.stat().st_size > max_size_bytes:
                        logger.warning(f"File too large, skipping: {file_path}")
                        continue
                except OSError as e:
                    logger.error(f"Error checking file size: {file_path}, {e}")
                    continue
                
                # Check include patterns
                if not any(fnmatch.fnmatch(file_path.name, pattern) for pattern in include_patterns):
                    continue
                
                # Check exclude patterns
                if any(fnmatch.fnmatch(file_path.name, pattern) for pattern in exclude_patterns):
                    continue
                
                # Determine host name
                host = self._get_host_name(file_path, dir_path)
                
                if host not in log_files:
                    log_files[host] = []
                log_files[host].append(file_path)
        
        return log_files
    
    def _get_host_name(self, file_path: Path, base_dir: Path) -> str:
        """
        Determine host name based on configuration strategy
        
        Args:
            file_path: Path to log file
            base_dir: Base directory path
        
        Returns:
            Host name string
        """
        strategy = self.config.get_host_detection_strategy()
        
        if strategy == 'filename':
            # Use filename without extension as host
            return file_path.stem
        
        elif strategy == 'directory':
            # Use parent directory name as host
            return file_path.parent.name
        
        elif strategy == 'auto':
            # Try to detect from structure
            # If file is directly in base_dir, use filename
            # Otherwise use parent directory name
            if file_path.parent == base_dir:
                return file_path.stem
            else:
                return file_path.parent.name
        
        else:
            # Default to filename
            return file_path.stem

    def parse_log_file(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        Parse a single log file
        
        Args:
            file_path: Path to log file
        
        Returns:
            List of parsed log entries
        """
        logs = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Try ISO 8601 syslog format first (e.g., 2025-12-17T16:13:08+00:00 RHEL-FRONT tailscaled[926]: message)
                    match = self.iso8601_syslog_pattern.match(line)
                    if match:
                        timestamp, host, process, pid, message = match.groups()
                        
                        # Determine log level from message content
                        level = "INFO"
                        if "error" in message.lower() or "fail" in message.lower():
                            level = "ERROR"
                        elif "warn" in message.lower():
                            level = "WARN"
                        elif "debug" in message.lower():
                            level = "DEBUG"
                        
                        service = file_path.stem
                        
                        logs.append({
                            'timestamp': timestamp,
                            'level': level,
                            'process': process,
                            'service': service,
                            'message': message,
                            'raw': line,
                            'file': str(file_path),
                            'line_number': line_num,
                            'host': host,
                            'pid': pid
                        })
                        continue
                    
                    # Try key-value format (e.g., 2025-12-17T23:00:19.900707+09:00 host=LOGS app=rsyslogd pid=- msg= message)
                    match = self.keyvalue_pattern.match(line)
                    if match:
                        timestamp, host, process, pid, message = match.groups()
                        
                        # Handle "-" as empty pid
                        if pid == '-':
                            pid = None
                        
                        # Determine log level from message content
                        level = "INFO"
                        if "error" in message.lower() or "fail" in message.lower():
                            level = "ERROR"
                        elif "warn" in message.lower():
                            level = "WARN"
                        elif "debug" in message.lower():
                            level = "DEBUG"
                        
                        service = file_path.stem
                        
                        logs.append({
                            'timestamp': timestamp,
                            'level': level,
                            'process': process,
                            'service': service,
                            'message': message,
                            'raw': line,
                            'file': str(file_path),
                            'line_number': line_num,
                            'host': host,
                            'pid': pid
                        })
                        continue
                    
                    # Try traditional Syslog format (e.g., Nov 26 12:00:01 host1 process[pid]: message)
                    match = self.syslog_pattern.match(line)
                    if match:
                        timestamp_str, host, process_raw, message = match.groups()
                        
                        # Add current year to timestamp if missing
                        # This is a simplification; ideally we'd handle year rollover
                        from datetime import datetime
                        current_year = datetime.now().year
                        timestamp = f"{current_year} {timestamp_str}"
                        
                        process, pid, level = self._parse_process_and_level(process_raw, message)
                        service = file_path.stem
                        
                        logs.append({
                            'timestamp': timestamp,
                            'level': level,
                            'process': process,
                            'service': service,
                            'message': message,
                            'raw': line,
                            'file': str(file_path),
                            'line_number': line_num
                        })
                        continue

                    # Try simple ISO format (e.g., 2024-01-01 12:00:00 INFO process: message)
                    match = self.iso_pattern.match(line)
                    if match:
                        timestamp, level, process, message = match.groups()
                        service = file_path.stem
                        logs.append({
                            'timestamp': timestamp,
                            'level': level,
                            'process': process,
                            'service': service,
                            'message': message,
                            'raw': line,
                            'file': str(file_path),
                            'line_number': line_num
                        })
                        continue
                        
                    # If line doesn't match pattern, treat as INFO with unknown process
                    logs.append({
                        'timestamp': '',
                        'level': 'INFO',
                        'process': 'unknown',
                        'service': file_path.stem,
                        'message': line,
                        'raw': line,
                        'file': str(file_path),
                        'line_number': line_num
                    })
        
        except Exception as e:
            logger.error(f"Error parsing log file {file_path}: {e}")
        
        return logs
    
    def get_logs_for_host(self, host: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Get logs for a specific host
        
        Args:
            host: Host name
            limit: Maximum number of logs to return
        
        Returns:
            List of log entries
        """
        log_files_map = self.find_log_files()
        
        if host not in log_files_map:
            logger.warning(f"No log files found for host: {host}")
            return []
        
        all_logs = []
        for file_path in log_files_map[host]:
            logs = self.parse_log_file(file_path)
            all_logs.extend(logs)
        
        # Sort by timestamp (if available) and limit
        all_logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return all_logs[:limit]
    
    def get_all_hosts(self) -> List[str]:
        """
        Get list of all available hosts
        
        Returns:
            List of host names
        """
        log_files_map = self.find_log_files()
        return sorted(log_files_map.keys())
    
    def get_stats_for_host(self, host: str) -> Dict[str, Any]:
        """
        Get statistics for a specific host
        
        Args:
            host: Host name
        
        Returns:
            Dictionary with statistics
        """
        logs = self.get_logs_for_host(host, limit=10000)  # Get more logs for stats
        
        if not logs:
            return {
                'total': 0,
                'info': 0,
                'warn': 0,
                'error': 0,
                'debug': 0
            }
        
        stats = {
            'total': len(logs),
            'info': sum(1 for log in logs if log['level'] == 'INFO'),
            'warn': sum(1 for log in logs if log['level'] == 'WARN'),
            'error': sum(1 for log in logs if log['level'] == 'ERROR'),
            'debug': sum(1 for log in logs if log['level'] == 'DEBUG')
        }
        
        return stats
