import paramiko
import sys
import select

new_host = "180.93.43.43"
user = "root"
password = "thaikuku1"
old_host = "74.81.54.150"
old_pass = "thaikuku1"

def main():
    print(f"Connecting to new VPS {new_host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(new_host, username=user, password=password)
    
    print("Installing sshpass and rsync...")
    stdin, stdout, stderr = ssh.exec_command("apt-get update && apt-get install -y sshpass rsync")
    stdout.read() # wait for finish
    
    print("Starting direct transfer from old VPS to new VPS (this might take a few minutes for 2.9GB)...")
    cmd = f"sshpass -p '{old_pass}' rsync -avz --progress -e 'ssh -o StrictHostKeyChecking=no' root@{old_host}:/opt/veo3-web/uploads/ /opt/veo3-web/uploads/"
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    # Read output continuously to prevent buffer full
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            sys.stdout.write(stdout.channel.recv(1024).decode('utf-8', errors='replace'))
            sys.stdout.flush()
        if stderr.channel.recv_stderr_ready():
            sys.stderr.write(stderr.channel.recv_stderr(1024).decode('utf-8', errors='replace'))
            sys.stderr.flush()
    
    print("\nSetting correct permissions on the new VPS...")
    ssh.exec_command("chown -R www-data:www-data /opt/veo3-web/uploads")
    
    ssh.close()
    print("Transfer complete!")

if __name__ == "__main__":
    main()
