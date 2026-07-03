import paramiko
import sys

host = "180.93.43.43"
user = "root"
password = "thaikuku1"

def run_ssh(host, cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read()
    ssh.close()
    return out

def main():
    cmd = """
python -c "
import urllib.request
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/extension-status', headers={'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NWIzMmE2Yi1jMDZkLTRhN2ItYjVmNC1iZTU0MzNiMDhjYWUiLCJleHQiOnRydWUsImV4cCI6MTc4NTY1NzAwOH0.RS4j7s2PIvDo6tduZXaaxjwvwTGlFhGYgPeKHUBeCYI'})
try:
    print(urllib.request.urlopen(req).read().decode())
except Exception as e:
    print(e)
"
    """
    out = run_ssh(host, cmd)
    sys.stdout.buffer.write(b"OUT: " + out + b"\n")

if __name__ == "__main__":
    main()
