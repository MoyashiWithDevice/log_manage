import os
import re
import pandas as pd
from datetime import datetime
from pathlib import Path
from config_loader import get_config

def get_hosts():
    """Get list of all available hosts from configured log directories"""
    config = get_config()
    from log_parser import LogParser
    parser = LogParser(config)
    return parser.get_all_hosts()

def parse_syslog_line(line):
    # Basic syslog format parser (adjust regex based on actual rsyslog format)
    # Example: Nov 26 12:00:01 host1 systemd[1]: Started Session 1 of user root.
    # This is a simplified regex and might need tuning for specific rsyslog templates
    regex = r"^([A-Z][a-z]{2}\s+\d+\s\d{2}:\d{2}:\d{2})\s(\S+)\s(\S+?)(?:\[(\d+)\])?:\s(.*)$"
    match = re.match(regex, line)
    if match:
        timestamp_str = match.group(1)
        # Add current year as syslog usually doesn't have it, or handle it properly
        timestamp = timestamp_str # Simplified
        host = match.group(2)
        process = match.group(3)
        pid = match.group(4)
        message = match.group(5)
        
        level = "INFO"
        if "error" in message.lower() or "fail" in message.lower():
            level = "ERROR"
        elif "warn" in message.lower():
            level = "WARN"
            
        return {
            "timestamp": timestamp,
            "host": host,
            "process": process,
            "message": message,
            "level": level,
            "raw": line.strip()
        }
    return None

def get_logs(host, limit=100):
    """Get logs for a specific host using configuration-based parser"""
    config = get_config()
    from log_parser import LogParser
    parser = LogParser(config)
    return parser.get_logs_for_host(host, limit)

def get_log_stats(host, time_range="1h"):
    """Get statistics for a specific host using configuration-based parser"""
    logs = get_logs(host, limit=10000)  # Analyze last 10000 logs for stats
    if not logs:
        return {"total": 0, "levels": {}, "time_series": [], "filtered_total": 0, "filtered_levels": {}}
    
    df = pd.DataFrame(logs)
    level_counts = df["level"].value_counts().to_dict()
    
    # Parse timestamps and create time-series data
    time_series = []
    filtered_total = 0
    filtered_levels = {}
    
    try:
        # Convert timestamp strings to datetime for filtering
        from datetime import datetime, timedelta
        import calendar
        import re
        
        def parse_timestamp(ts_str):
            """Parse various timestamp formats"""
            if not ts_str or ts_str == '':
                return None
            
            try:
                # Try ISO 8601 format with T (e.g., 2025-12-17T23:00:19.900707+09:00)
                if 'T' in ts_str:
                    # Parse ISO 8601 with timezone
                    match = re.match(r'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?([+-]\d{2}:\d{2})?', ts_str)
                    if match:
                        date_part = match.group(1)
                        time_part = match.group(2)
                        tz_part = match.group(3)
                        dt_str = f"{date_part} {time_part}"
                        result = datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
                        
                        # Adjust for timezone if present - convert to local time (JST)
                        if tz_part:
                            tz_sign = 1 if tz_part[0] == '+' else -1
                            tz_hours = int(tz_part[1:3])
                            tz_minutes = int(tz_part[4:6])
                            tz_offset = timedelta(hours=tz_hours, minutes=tz_minutes) * tz_sign
                            # Convert to UTC then to local time (JST is +09:00)
                            result_utc = result - tz_offset
                            jst_offset = timedelta(hours=9)
                            result = result_utc + jst_offset
                        
                        return result
                
                # Try simple ISO format (YYYY-MM-DD HH:MM:SS)
                if '-' in ts_str and ':' in ts_str:
                    return datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                
                parts = ts_str.split()
                
                # Check if first part is a year (e.g., "2025 Nov 26 14:23:30")
                if len(parts) >= 4 and parts[0].isdigit() and len(parts[0]) == 4:
                    year = int(parts[0])
                    month_abbr = parts[1]
                    month_num = list(calendar.month_abbr).index(month_abbr)
                    day = int(parts[2])
                    time_part = parts[3]
                    hour, minute, second = map(int, time_part.split(':'))
                    return datetime(year, month_num, day, hour, minute, second)
                
                # Try syslog format (Nov 26 12:00:01)
                current_year = datetime.now().year
                month_abbr = parts[0]
                month_num = list(calendar.month_abbr).index(month_abbr)
                day = int(parts[1])
                time_part = parts[2]
                hour, minute, second = map(int, time_part.split(':'))
                return datetime(current_year, month_num, day, hour, minute, second)
            except Exception as e:
                return None
        
        df['datetime'] = df['timestamp'].apply(parse_timestamp)
        
        # Drop rows with invalid timestamps
        df_valid = df.dropna(subset=['datetime'])
        
        if len(df_valid) == 0:
            # No valid timestamps, return empty time series
            return {
                "total": len(logs),
                "levels": level_counts,
                "time_series": [],
                "filtered_total": len(logs),
                "filtered_levels": level_counts
            }
        
        # Ensure datetime column is datetime type
        df_valid['datetime'] = pd.to_datetime(df_valid['datetime'])
        
        # Determine time window and grouping based on time_range
        now = datetime.now()
        
        # Handle "all" time range - no filtering
        if time_range == "all":
            cutoff = df_valid['datetime'].min()
            max_time = df_valid['datetime'].max()
            time_diff = max_time - cutoff
            
            # Choose appropriate grouping based on data range
            if time_diff <= timedelta(hours=1):
                time_format = '%H:%M'
                delta = timedelta(minutes=1)
            elif time_diff <= timedelta(days=1):
                time_format = '%m/%d %H:00'
                delta = timedelta(hours=1)
            else:
                time_format = '%m/%d'
                delta = timedelta(days=1)
            
            # Generate time slots from data range
            all_time_slots = []
            current_time = cutoff
            while current_time <= max_time:
                all_time_slots.append(current_time.strftime(time_format))
                current_time += delta
            
            df_filtered = df_valid.copy()
        else:
            if time_range == "1h":
                cutoff = now - timedelta(hours=1)
                time_format = '%H:%M'
                delta = timedelta(minutes=1)
            elif time_range == "1d":
                cutoff = now - timedelta(days=1)
                time_format = '%m/%d %H:00'
                delta = timedelta(hours=1)
            elif time_range == "1w":
                cutoff = now - timedelta(weeks=1)
                time_format = '%m/%d'
                delta = timedelta(days=1)
            elif time_range == "1m":
                cutoff = now - timedelta(days=30)
                time_format = '%m/%d'
                delta = timedelta(days=1)
            else:
                cutoff = now - timedelta(hours=1)
                time_format = '%H:%M'
                delta = timedelta(minutes=1)
            
            # Generate all time slots in the range
            all_time_slots = []
            current_time = cutoff
            while current_time <= now:
                all_time_slots.append(current_time.strftime(time_format))
                current_time += delta
            
            # Filter logs by time range
            df_filtered = df_valid[df_valid['datetime'] >= cutoff].copy()
        
        # Calculate filtered totals and levels
        filtered_total = len(df_filtered)
        if len(df_filtered) > 0:
            filtered_levels = df_filtered["level"].value_counts().to_dict()
        else:
            filtered_levels = {}
        
        # Group by time format
        if len(df_filtered) > 0:
            df_filtered['time_group'] = df_filtered['datetime'].dt.strftime(time_format)
        
            # Get all unique levels
            all_levels = ['INFO', 'WARN', 'ERROR']
            
            # Group by time and level, count occurrences
            grouped = df_filtered.groupby(['time_group', 'level']).size().reset_index(name='count')
            # Pivot to create time-series format
            pivot = grouped.pivot(index='time_group', columns='level', values='count').fillna(0)
        else:
            # Create empty pivot
            pivot = pd.DataFrame(index=[], columns=['INFO', 'WARN', 'ERROR']).fillna(0)
        
        # Ensure all levels are present
        for level in ['INFO', 'WARN', 'ERROR']:
            if level not in pivot.columns:
                pivot[level] = 0
        
        # Reindex to include all time slots (fill missing with 0)
        pivot = pivot.reindex(all_time_slots, fill_value=0)
        
        # Limit to reasonable number of data points by sampling
        max_points = 100
        if len(pivot) > max_points:
            step = len(pivot) // max_points
            pivot = pivot.iloc[::step]
        
        # Convert to list of dicts for frontend
        for time_str in pivot.index:
            entry = {"time": time_str}
            for level in ['INFO', 'WARN', 'ERROR']:
                entry[level] = int(pivot.loc[time_str, level])
            time_series.append(entry)
            
    except Exception as e:
        print(f"Error creating time series: {e}")
        import traceback
        traceback.print_exc()
    
    return {
        "total": len(logs),
        "levels": level_counts,
        "time_series": time_series,
        "filtered_total": filtered_total,
        "filtered_levels": filtered_levels
    }
