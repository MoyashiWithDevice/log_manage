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
        return {"total": 0, "levels": {}, "time_series": []}
    
    df = pd.DataFrame(logs)
    level_counts = df["level"].value_counts().to_dict()
    
    # Parse timestamps and create time-series data
    time_series = []
    try:
        # Convert timestamp strings to datetime for filtering
        from datetime import datetime, timedelta
        import calendar
        
        def parse_timestamp(ts_str):
            """Parse various timestamp formats"""
            if not ts_str or ts_str == '':
                return None
            
            try:
                # Try ISO format first (YYYY-MM-DD HH:MM:SS)
                if '-' in ts_str and ':' in ts_str:
                    return pd.to_datetime(ts_str, errors='coerce')
                
                # Try syslog format (Nov 26 12:00:01)
                current_year = datetime.now().year
                month_abbr = ts_str.split()[0]
                month_num = list(calendar.month_abbr).index(month_abbr)
                day = int(ts_str.split()[1])
                time_part = ts_str.split()[2]
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
                "time_series": []
            }
        
        # Ensure datetime column is datetime type
        df_valid['datetime'] = pd.to_datetime(df_valid['datetime'])
        
        # Determine time window and grouping based on time_range
        now = datetime.now()
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
        "time_series": time_series
    }
