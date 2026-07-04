import paramiko, os, subprocess

key_path = 'github_actions_key'
if not os.path.exists(key_path):
    subprocess.run(['ssh-keygen', '-t', 'ed25519', '-f', key_path, '-N', ''], check=True)

with open(f'{key_path}.pub', 'r') as f:
    pub_key = f.read().strip()
with open(key_path, 'r') as f:
    priv_key = f.read().strip()

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.93.43.43', username='root', password='thaikuku1')
ssh.exec_command(f'mkdir -p ~/.ssh && echo "{pub_key}" >> ~/.ssh/authorized_keys')

print('=== PRIVATE KEY FOR GITHUB (COPY EVERYTHING BELOW) ===')
print(priv_key)
print('======================================================')
