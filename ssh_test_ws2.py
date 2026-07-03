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
    err = stderr.read()
    ssh.close()
    return out, err

def main():
    cmd = """
cat << 'EOF' > /tmp/test_ws2.py
import asyncio
import websockets

async def test_ws():
    uri = "ws://127.0.0.1:8000/ws/extension?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NWIzMmE2Yi1jMDZkLTRhN2ItYjVmNC1iZTU0MzNiMDhjYWUiLCJleHQiOnRydWUsImV4cCI6MTc4NTY1NzAwOH0.RS4j7s2PIvDo6tduZXaaxjwvwTGlFhGYgPeKHUBeCYI"
    try:
        async with websockets.connect(uri) as ws:
            print("Connected!")
            res = await ws.recv()
            print("Received:", res)
    except Exception as e:
        print("WS Error:", e)

asyncio.run(test_ws())
EOF
/opt/veo3-web/backend/venv/bin/pip install websockets
/opt/veo3-web/backend/venv/bin/python /tmp/test_ws2.py
    """
    out, err = run_ssh(host, cmd)
    sys.stdout.buffer.write(b"OUT: " + out + b"\n")
    sys.stdout.buffer.write(b"ERR: " + err + b"\n")

if __name__ == "__main__":
    main()
