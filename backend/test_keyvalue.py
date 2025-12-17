import re

# Test key-value format pattern
pattern = re.compile(
    r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2})\s+host=(\S+)\s+app=(\S+)\s+pid=(\S+)\s+msg=\s*(.*)$'
)

line = "2025-12-17T23:00:19.900707+09:00 host=LOGS app=rsyslogd pid=- msg= rsyslogd's groupid changed to 104"

match = pattern.match(line)
if match:
    print("Match found!")
    print(f"  timestamp: {match.group(1)}")
    print(f"  host: {match.group(2)}")
    print(f"  app: {match.group(3)}")
    print(f"  pid: {match.group(4)}")
    print(f"  msg: {match.group(5)}")
else:
    print("No match")
