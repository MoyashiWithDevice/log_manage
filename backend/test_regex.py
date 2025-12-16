import re

line = "Nov 26 12:00:01 host1 systemd[1]: Started Session 1 of user root."
regex = r"^([A-M][a-z]{2}\s+\d+\s\d{2}:\d{2}:\d{2})\s(\S+)\s(\S+?)(?:\[(\d+)\])?:\s(.*)$"

match = re.match(regex, line)
if match:
    print("Match found!")
    print(match.groups())
else:
    print("No match.")

line2 = "Nov 26 12:10:00 host1 kernel: [12345.678901] UFW BLOCK: ..."
match2 = re.match(regex, line2)
if match2:
    print("Match2 found!")
    print(match2.groups())
else:
    print("No match2.")
