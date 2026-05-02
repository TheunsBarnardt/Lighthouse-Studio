# Runbook: Server Provisioning

Initial setup of the Afrihost VPS. Every command. Every verification.
Run this when provisioning the reference server or a replacement.

**Server spec:** Ubuntu 24.04 LTS, 8 GB RAM, 4 vCPU, 100 GB SSD
**Estimated time:** 45–60 minutes

---

## 1. Provision the VPS

1. Order an Afrihost Cloud VPS with the above spec.
2. Select Ubuntu 24.04 LTS as the OS.
3. Choose your SSH key during provisioning (or add it immediately after provisioning).
4. Note the public IP address — you'll need it for DNS and SSH.

---

## 2. Initial SSH access

```bash
ssh root@<SERVER_IP>
```

---

## 3. Create a non-root sudo user

```bash
adduser platform
usermod -aG sudo platform
# Copy SSH key from root to the new user
cp -r /root/.ssh /home/platform/
chown -R platform:platform /home/platform/.ssh
chmod 700 /home/platform/.ssh
chmod 600 /home/platform/.ssh/authorized_keys
```

Verify you can SSH as the new user from your local machine before disabling root SSH:

```bash
ssh platform@<SERVER_IP>
```

---

## 4. Harden SSH

Edit `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Set:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

```bash
sudo systemctl restart sshd
```

Verify root SSH is blocked before closing your session.

---

## 5. Firewall (UFW)

```bash
sudo ufw allow 22/tcp        # SSH — restrict to your IP(s) in the next step
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

**IP-restrict SSH** (replace with your actual IPs):

```bash
sudo ufw delete allow 22/tcp
sudo ufw allow from <YOUR_HOME_IP> to any port 22
sudo ufw allow from <YOUR_WORK_IP> to any port 22
sudo ufw reload
```

If your IP changes (no static IP), you'll need a VPN or bastion host. Document which IPs are allowed in your password manager.

---

## 6. fail2ban and unattended-upgrades

```bash
sudo apt-get update
sudo apt-get install -y fail2ban unattended-upgrades

# Enable automatic security updates
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Enable and start fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status
```

---

## 7. Hostname, timezone, NTP

```bash
sudo hostnamectl set-hostname platform-vps
sudo timedatectl set-timezone Africa/Johannesburg
sudo timedatectl set-ntp true
timedatectl status
```

---

## 8. Docker Engine

Follow Docker's official Ubuntu installation:

```bash
# Remove any old Docker packages
sudo apt-get remove -y docker docker-engine docker.io containerd runc

# Add Docker's GPG key and repository
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add platform user to docker group (avoid sudo for docker commands)
sudo usermod -aG docker platform

# Verify
docker --version
docker compose version
```

Log out and back in for the group change to take effect.

---

## 9. Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Wait for installation to complete. Coolify runs on port 8000.

Access the Coolify admin UI: navigate to `http://<SERVER_IP>:8000` from your browser.
Complete the initial setup wizard:

- Create the admin account (use a strong password; store in password manager)
- Configure the server (add the current server as a managed server)

---

## 10. DNS Configuration

In your domain registrar (wherever `<YOUR_DOMAIN>` is managed):

| Type | Name | Value         | TTL |
| ---- | ---- | ------------- | --- |
| A    | `@`  | `<SERVER_IP>` | 300 |
| A    | `*`  | `<SERVER_IP>` | 300 |

The wildcard `*` record handles `dev.`, `staging.`, `coolify.`, etc. automatically.

Wait for DNS propagation (usually under 5 minutes with TTL=300).

---

## 11. Configure Caddy override

Copy `infra/caddy/Caddyfile.platform` to the server and configure it as a Coolify Caddy override.
See `docs/runbooks/environments.md` for details.

---

## 12. Verification checklist

- [ ] SSH as root is blocked
- [ ] SSH as `platform` user with key works
- [ ] `ufw status` shows only 22 (IP-restricted), 80, 443
- [ ] `fail2ban-client status` shows active jails
- [ ] `unattended-upgrades` is enabled
- [ ] `docker version` works as `platform` user (no sudo)
- [ ] `docker compose version` works
- [ ] Coolify admin UI is reachable at `http://<SERVER_IP>:8000`
- [ ] DNS resolves: `nslookup dev.<YOUR_DOMAIN>` returns the server IP
- [ ] `curl -I https://dev.<YOUR_DOMAIN>` returns a valid SSL certificate

---

## Troubleshooting

**SSH connection refused:** Check UFW rules. Make sure your IP is in the allowlist.

**Coolify install fails:** Re-run the install command. Check Docker is running: `systemctl status docker`.

**DNS not resolving:** TTL may not have expired. Use `dig +short dev.<YOUR_DOMAIN> @8.8.8.8` to bypass local DNS cache.
