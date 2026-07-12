# 🚜 Multi-Vendor Agri-Commerce — Deployment Guide

> **Target**: AWS EC2 (Ubuntu 24.04) · **Stack**: Node.js 22 · PostgreSQL · Redis · Nginx · PM2

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [AWS EC2 Setup](#aws-ec2-setup)
4. [Nginx Configuration](#nginx-configuration)
5. [PM2 Installation & Setup](#pm2-installation--setup)
6. [GitHub Secrets Setup](#github-secrets-setup)
7. [SSH Key Generation](#ssh-key-generation)
8. [First Deployment](#first-deployment)
9. [Rollback Steps](#rollback-steps)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Internet
    │
    ▼
┌──────────────┐         ┌──────────────────┐
│   AWS EC2     │         │   GitHub Actions  │
│  (Ubuntu 24.04)│        │   (CI/CD Pipeline)│
│              │         │                  │
│  ┌──────────┐│  :80    │  push → main     │
│  │  Nginx    │◄────────┤  triggers build  │
│  │ (reverse  ││         │  & deploy        │
│  │  proxy)   ││         └──────────────────┘
│  └────┬─────┘│
│       │      │
│  ┌────┴─────┐│
│  │  PM2     ││
│  │ (process ││
│  │  manager)││
│  │          ││
│  │ ┌──────┐ ││  :3000     ┌─────────────┐
│  │ │backend│─┼───────────►│  PostgreSQL  │
│  │ └──────┘ ││            └─────────────┘
│  │ ┌──────┐ ││  :3001
│  │ │frontnd│─┼──────┐
│  │ └──────┘ ││      │
│  └──────────┘│      ▼
│              │   ┌─────────────┐
└──────────────┘   │    Redis    │
                   └─────────────┘
```

**Ports**:

| Service  | Port | Description             |
|----------|------|-------------------------|
| Nginx    | 80   | Reverse proxy (public)  |
| Nginx    | 443  | HTTPS (with SSL)        |
| Backend  | 3000 | Express API             |
| Frontend | 3001 | Next.js SSR             |
| Postgres | 5432 | Database                |
| Redis    | 6379 | Cache / queue           |

---

## Prerequisites

### Required Accounts

1. **AWS Account** — for EC2 instance
2. **GitHub Repository** — with your code pushed
3. **Domain Name** (optional) — for SSL/HTTPS
4. **Amazon S3 Bucket** — for image uploads

### Local Tools

```bash
# Install these on your development machine
node -v     # v22.x LTS
npm -v      # 10.x+
git --version
ssh -V
```

---

## AWS EC2 Setup

### 1. Launch an EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. **Name**: `multi-vendor-prod`
3. **AMI**: Ubuntu Server 24.04 LTS (HVM)
4. **Instance type**: `t3.medium` (2 vCPU, 4 GB RAM) — minimum for production
5. **Key pair**: Create or select existing (save `.pem` file)
6. **Network settings**:
   - Allow SSH (22) — your IP only
   - Allow HTTP (80) — 0.0.0.0/0
   - Allow HTTPS (443) — 0.0.0.0/0
   - Allow custom TCP (3000, 3001) — optional for testing
7. **Storage**: 30 GB gp3 (or more for production)
8. **Launch**

### 2. Connect to EC2

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<ec2-public-ip>
```

### 3. Install Dependencies

Run the following on the EC2 instance:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools
sudo apt install -y build-essential git

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres psql -c "CREATE USER multivenor WITH PASSWORD 'multivenor_secret';"
sudo -u postgres psql -c "CREATE DATABASE multivenor_db OWNER multivenor;"

# Install Redis
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Install Nginx
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install PM2 globally
sudo npm install -g pm2

# Verify installations
node -v && npm -v && psql --version && redis-cli --version && nginx -v && pm2 -v
```

---

## Nginx Configuration

Create the Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/multivenor
```

```nginx
# ─────────────────────────────────────────────────────────────
#  Nginx Config — Multi-Vendor Agri-Commerce
# ─────────────────────────────────────────────────────────────

upstream backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream frontend {
    server 127.0.0.1:3001;
    keepalive 64;
}

# ── HTTP → HTTPS redirect (uncomment after SSL setup) ───────
# server {
#     listen 80;
#     server_name yourdomain.com www.yourdomain.com;
#     return 301 https://$server_name$request_uri;
# }

# ── Main server block ───────────────────────────────────────
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # ── Security headers ─────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── Gzip compression ─────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_vary on;

    # ── File upload size ─────────────────────────────────
    client_max_body_size 50M;

    # ── Logs ─────────────────────────────────────────────
    access_log /var/log/nginx/multivenor-access.log;
    error_log  /var/log/nginx/multivenor-error.log;

    # ── Backend API proxy ────────────────────────────────
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;

        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    }

    # ── Socket.io proxy ──────────────────────────────────
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    # ── Health check ─────────────────────────────────────
    location /health {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ── Frontend proxy (Next.js SSR) ─────────────────────
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;

        # Cache static assets
        location /_next/static {
            proxy_pass http://frontend;
            proxy_cache_valid 200 365d;
            add_header Cache-Control "public, immutable, max-age=31536000";
        }

        location /static {
            proxy_pass http://frontend;
            proxy_cache_valid 200 365d;
            add_header Cache-Control "public, immutable, max-age=31536000";
        }
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/multivenor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt (Optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Follow the prompts — Certbot auto-updates Nginx config
# Test auto-renewal
sudo certbot renew --dry-run
```

---

## PM2 Installation & Setup

PM2 is already installed globally. Configure it to start on boot:

```bash
# Generate and save startup script
pm2 startup systemd -u ubuntu

# (copy and run the command output by pm2 startup)
```

### PM2 Commands Cheat Sheet

```bash
# Start all processes
pm2 start ecosystem.config.cjs

# View status
pm2 status
pm2 list

# View logs
pm2 logs          # all logs
pm2 logs backend  # backend only
pm2 logs frontend # frontend only

# Restart
pm2 restart all
pm2 restart backend
pm2 restart frontend

# Stop / Delete
pm2 stop all
pm2 delete all

# Save process list
pm2 save

# Monitor (real-time dashboard)
pm2 monit
```

---

## GitHub Secrets Setup

Configure these secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description | Example |
|--------|-------------|---------|
| `EC2_HOST` | Public IP or DNS of EC2 | `12.34.56.78` |
| `EC2_USERNAME` | SSH user | `ubuntu` |
| `EC2_SSH_KEY` | Private SSH key (PEM) | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `EC2_PORT` | SSH port (default 22) | `22` |
| `NEXT_PUBLIC_API_URL` | API URL from frontend | `https://api.yourdomain.com/api` |
| `NEXT_PUBLIC_APP_URL` | Frontend URL | `https://yourdomain.com` |
| `NEXT_PUBLIC_ENABLE_SOCKET` | Enable WebSocket | `true` |

**Important**: Copy the entire contents of your private key file (including `-----BEGIN` and `-----END` lines) into the `EC2_SSH_KEY` secret value.

---

## SSH Key Generation

If you don't already have an SSH key pair:

### On your local machine

```bash
# Generate an ED25519 key (recommended)
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Or RSA (if ED25519 not supported)
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"

# Copy public key to clipboard
cat ~/.ssh/id_ed25519.pub
```

### On EC2 instance

```bash
# Add the public key to authorized_keys
echo "<paste-your-public-key>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Or copy from local machine
# From your local machine:
ssh-copy-id -i ~/.ssh/id_ed25519.pub ubuntu@<ec2-ip>
```

### Add private key to GitHub Secrets

```bash
# Copy the private key contents
cat ~/.ssh/id_ed25519

# Add this as EC2_SSH_KEY in GitHub Secrets
```

---

## First Deployment

### 1. Clone the Repository (EC2)

```bash
cd ~
git clone git@github.com:your-org/multi-vendor.git app
cd app
```

### 2. Set Up Environment Files

```bash
# Backend
cp backend/.env.example backend/.env
nano backend/.env   # Fill in real values

# Frontend
cp frontend/.env.example frontend/.env
nano frontend/.env  # Fill in real values
```

### 3. Run First Deployment Manually

```bash
chmod +x deploy.sh
./deploy.sh
```

Or trigger via GitHub Actions:

1. Push to `main` branch
2. The `Deploy to EC2` workflow runs automatically
3. Monitor progress in GitHub Actions tab
4. Verify: `https://yourdomain.com/health`

### 4. Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check backend health
curl http://localhost:3000/health

# Check Nginx
curl http://localhost/health

# Check logs
pm2 logs backend --lines 50
```

---

## Rollback Steps

### Automatic Rollback (via deploy script)

```bash
cd ~/app
./deploy.sh --rollback
```

This restores the previous release from `~/app/releases/`.

### Manual Rollback

```bash
# 1. SSH into EC2
ssh -i ~/.ssh/your-key.pem ubuntu@<ec2-ip>

# 2. Go to previous commit
cd ~/app
git log --oneline -5
git checkout <previous-commit-hash>

# 3. Rebuild and restart
npm install --prefix backend
npm install --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
pm2 restart all

# 4. Verify
pm2 status
curl http://localhost:3000/health
```

### Rollback with Git

```bash
# Revert to specific commit
git revert HEAD~1  # revert last commit
git push origin main

# Or hard reset
git reset --hard <commit-hash>
git push origin main --force  # use with caution!
```

---

## Troubleshooting

### **PM2 Process Crashes**

```bash
# Check logs
pm2 logs backend --lines 100
pm2 logs frontend --lines 100

# Check for port conflicts
sudo lsof -i :3000
sudo lsof -i :3001

# Kill conflicting processes
sudo kill -9 <PID>

# Restart with increased memory
pm2 start ecosystem.config.cjs --max-memory-restart 2G
```

### **Nginx Issues**

```bash
# Test configuration
sudo nginx -t

# Check error log
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### **Database Connection Issues**

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U multivenor -d multivenor_db

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### **Redis Connection Issues**

```bash
# Check Redis status
sudo systemctl status redis-server

# Test connection
redis-cli ping
# Should response: PONG
```

### **Deployment Fails in GitHub Actions**

```bash
# 1. Check GitHub Actions logs for error details
# 2. Verify EC2_HOST is reachable:
ping <ec2-ip>
# 3. Verify SSH key is valid:
ssh -i ~/.ssh/deploy_key ubuntu@<ec2-ip> "echo OK"
# 4. Check EC2 security group (port 22 must be open)
# 5. Re-run the failed workflow from GitHub Actions UI
```

### **Application Errors**

```bash
# Check application logs
tail -f ~/app/logs/backend-error.log
tail -f ~/app/logs/frontend-error.log

# Check system resources
htop                  # CPU / memory
df -h                 # Disk space
free -h               # Memory usage
```

### **Next.js Build Failures**

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild with debug output
NEXT_TELEMETRY_DEBUG=1 npm run build

# Check Node.js version compatibility
node -v  # Must be 18+
```

### **Common SSH Issues**

```bash
# Fix SSH permissions
chmod 600 ~/.ssh/deploy_key
chmod 700 ~/.ssh

# Test SSH connection with verbose output
ssh -vvv -i ~/.ssh/deploy_key ubuntu@<ec2-ip>

# Known host issues
ssh-keygen -R <ec2-ip>  # Remove old host key
```

---

## Monitoring & Maintenance

### Log Rotation

Logs are automatically managed by PM2 but you can set up `logrotate`:

```bash
sudo apt install -y logrotate
```

### Regular Updates

```bash
# Weekly server updates
sudo apt update && sudo apt upgrade -y
sudo systemctl restart nginx
pm2 restart all
```

### Backup Database

```bash
# Manual backup
pg_dump -U multivenor multivenor_db > ~/backups/db_$(date +%Y%m%d).sql

# Restore
psql -U multivenor -d multivenor_db < ~/backups/db_20260101.sql
```

---

## Project Structure (on EC2)

```
/home/ubuntu/app/
├── backend/
│   ├── dist/          # Compiled JS
│   ├── node_modules/
│   ├── prisma/        # Schema + migrations
│   ├── .env           # Backend env vars
│   └── package.json
├── frontend/
│   ├── .next/         # Next.js build
│   ├── node_modules/
│   ├── .env           # Frontend env vars
│   └── package.json
├── logs/
│   ├── backend-error.log
│   ├── backend-out.log
│   ├── frontend-error.log
│   └── frontend-out.log
├── releases/          # Rollback snapshots
├── ecosystem.config.cjs
├── deploy.sh
└── DEPLOYMENT.md
```
