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
    cmds = [
        "python -c \"import urllib.request; req = urllib.request.Request('http://127.0.0.1:8000/ws/extension?token=abc', headers={'Connection': 'Upgrade', 'Upgrade': 'websocket', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13'}); print(urllib.request.urlopen(req).read())\""
    ]
    for cmd in cmds:
        print(f"Running: {cmd}")
        try:
            out = run_ssh(host, cmd)
            sys.stdout.buffer.write(out)
        except Exception as e:
            print("Exception:", e)

if __name__ == "__main__":
    main()
