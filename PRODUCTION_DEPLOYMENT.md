# 🚀 Production Deployment Guide — Thikedar App (AWS Free Tier)

> **Goal:** Deploy this app on AWS Free Tier using EC2 (t2.micro) + RDS PostgreSQL (db.t3.micro) — **₹0/month for 12 months**.

---

## 📋 Prerequisites

| Requirement | How to Get |
|---|---|
| **AWS Account** | Sign up at [aws.amazon.com/free](https://aws.amazon.com/free) |
| **AWS CLI installed & configured** | `aws configure` — use your Access Key ID & Secret |
| **SSH Key Pair** | Will be auto-created by the deploy script |
| **GitHub repo** | Push your code to a GitHub repository |
| **Node.js 22+** (local) | For testing builds locally |

---

## 🗺️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Internet                           │
└──────────┬──────────────────────────────┬───────────┘
           │                              │
    ┌──────▼──────┐              ┌───────▼────────┐
    │   EC2        │              │   RDS           │
    │   t2.micro   │◄────SSH─────│   PostgreSQL    │
    │   (App)      │   Port 5432 │   db.t3.micro   │
    │              │              │                 │
    │  Node/Express│              │   DB: thikedar  │
    │  PM2 (prod)  │              │                 │
    │  Nginx (SSL) │              │   Storage: 20GB │
    └──────────────┘              └─────────────────┘
```

---

## 🚀 Method 1: One-Click Deploy (Automated)

The **existing [`deploy-aws.sh`](deploy-aws.sh)** script handles everything automatically.

### Steps:

1. **Edit the config** at the top of [`deploy-aws.sh`](deploy-aws.sh:26):
   ```bash
   GIT_REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"  # ← Change this
   DB_PASSWORD="Thikedar123!"                                      # ← Change this
   # Optional (for custom domain + SSL):
   DOMAIN_NAME="thikedar.yourdomain.com"
   EMAIL_FOR_SSL="your@email.com"
   ```

2. **Run the script:**
   ```bash
   chmod +x deploy-aws.sh
   ./deploy-aws.sh
   ```

3. **What it does automatically:**
   | Step | Action |
   |---|---|
   | 1 | Creates EC2 SSH Key Pair |
   | 2 | Creates Security Groups (Web + RDS) |
   | 3 | Creates RDS PostgreSQL (15-20 min) |
   | 4 | Gets Ubuntu 22.04 AMI |
   | 5 | Launches EC2 t2.micro instance |
   | 6 | Waits for SSH to be ready |
   | 7 | Uploads code via rsync, installs Node 22, builds app, pushes DB schema, starts with PM2 |
   | 8 | (Optional) Sets up Nginx reverse proxy + SSL via Certbot |
   | 9 | Verifies deployment |

4. **Done!** Your app will be at: `http://<EC2_PUBLIC_IP>:3000`

---

## 🛠️ Method 2: Manual Setup (More Control)

### Step 1: Create RDS PostgreSQL

```bash
# Create security group for RDS
RDS_SG=$(aws ec2 create-security-group \
  --group-name thikedar-rds-sg \
  --description "RDS security group" \
  --query 'GroupId' --output text)

# Allow PostgreSQL from anywhere (or restrict to EC2 SG)
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp --port 5432 \
  --cidr 0.0.0.0/0

# Create RDS instance (Free Tier)
aws rds create-db-instance \
  --db-instance-identifier thikedar-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username postgres \
  --master-user-password "YourStrongPass123!" \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids $RDS_SG \
  --db-name thikedar \
  --backup-retention-period 7 \
  --deletion-protection \
  --no-publicly-accessible
```

⏳ **Wait 5-10 minutes** for RDS to be `available`.

Get the endpoint:
```bash
aws rds describe-db-instances \
  --db-instance-identifier thikedar-db \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

### Step 2: Launch EC2 Instance

```bash
# Create security group for web
WEB_SG=$(aws ec2 create-security-group \
  --group-name thikedar-web-sg \
  --description "Web server SG" \
  --query 'GroupId' --output text)

# Open ports
for port in 22 80 443 3000; do
  aws ec2 authorize-security-group-ingress \
    --group-id $WEB_SG \
    --protocol tcp --port $port \
    --cidr 0.0.0.0/0
done

# Create key pair
aws ec2 create-key-pair --key-name thikedar-key \
  --query 'KeyMaterial' --output text > thikedar-key.pem
chmod 400 thikedar-key.pem

# Launch EC2 (t2.micro Free Tier)
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id resolve-ssm:/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id \
  --instance-type t2.micro \
  --key-name thikedar-key \
  --security-group-ids $WEB_SG \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=thikedar-server}]" \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --instance-ids $INSTANCE_ID
EC2_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "EC2 IP: $EC2_IP"
```

### Step 3: SSH & Setup Server

```bash
ssh -i thikedar-key.pem ubuntu@$EC2_IP
```

Inside the EC2, run:

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git

# Clone your repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git ~/nirmaan
cd ~/nirmaan

# Create .env file
cat > .env << EOF
DATABASE_URL="postgres://postgres:YourStrongPass123@<RDS_ENDPOINT>:5432/thikedar"
JWT_SECRET="$(openssl rand -hex 32)"
NODE_ENV=production
EOF

# Install & build
npm install
npm run build

# Push DB schema
npm run db:push

# Install PM2 and start
sudo npm install -g pm2
NODE_ENV=production pm2 start dist/server.cjs --name thikedar
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### Step 4: Setup Nginx Reverse Proxy (Optional but Recommended)

```bash
sudo tee /etc/nginx/sites-available/thikedar > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase upload size for photos
    client_max_body_size 50M;
}
NGINX

sudo ln -sf /etc/nginx/sites-available/thikedar /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Step 5: Verify

```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"...","uptime":...}
```

Your app is now live at: **`http://<EC2_IP>`** (port 80 via Nginx)

---

## 🔐 Setting Up SSL (HTTPS) with Custom Domain

If you have a domain, add SSL for free:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com --non-interactive --agree-tos -m your@email.com
```

---

## 📦 Production Checklist

### ✅ Must-Do Before Going Live

| # | Item | How |
|---|---|---|
| 1 | **Strong JWT secret** | `openssl rand -hex 32` |
| 2 | **Strong DB password** | At least 12 chars with uppercase, numbers, special |
| 3 | **RDS deletion protection** | Already ON in the deploy script |
| 4 | **Health check endpoint** | ✅ Added at [`server.ts`](server.ts:59) — `/api/health` |
| 5 | **Security headers** | ✅ Helmet is configured |
| 6 | **Rate limiting** | ✅ 200 req/15min on `/api/` routes |
| 7 | **RDS backup** | ✅ 7-day retention configured |
| 8 | **PM2 auto-restart** | ✅ `pm2 startup` configured |
| 9 | **Nginx reverse proxy** | ✅ (Recommended) |
| 10 | **Upload size limit** | ✅ 50MB configured |

### 🔵 Recommended for Production

| # | Item | How |
|---|---|---|
| 1 | **Custom domain + SSL** | Certbot (free) or Cloudflare |
| 2 | **CloudWatch alarm** | Alert if CPU > 80% or disk full |
| 3 | **Elastic IP** (static IP) | `aws ec2 allocate-address` + associate |
| 4 | **Uptime monitoring** | Use [uptimerobot.com](https://uptimerobot.com) (free) |
| 5 | **DB migration safety** | Use `drizzle-kit generate` + `migrate` instead of `push` for production |
| 6 | **GitHub Actions CI/CD** | Auto-deploy on git push |

---

## 🔄 Updating the App

```bash
ssh -i thikedar-key.pem ubuntu@<EC2_IP>

cd ~/nirmaan
git pull
npm install
npm run build
npm run db:push    # if schema changed
pm2 restart thikedar
```

---

## 🐞 Common Issues & Fixes

### 1. RDS Connection Refused
```bash
# Check if EC2 security group allows outbound to RDS
# Check if RDS security group allows inbound from EC2 SG
```

### 2. App Not Starting
```bash
pm2 logs thikedar --lines 50
# Check for missing env vars or DB connection issues
```

### 3. Port 3000 Already in Use
```bash
sudo lsof -i :3000  # Find what's using it
pm2 delete thikedar && pm2 start dist/server.cjs --name thikedar
```

### 4. "EC2 Instance Limit Exceeded"
You may need to request a limit increase from AWS (default is 5 instances per region).

---

## 💰 Cost Breakdown (Free Tier)

| Service | Instance | Free Tier | Cost |
|---|---|---|---|
| **EC2** | t2.micro (1 vCPU, 1GB RAM) | 750 hrs/month | **₹0/month** |
| **RDS** | db.t3.micro (1 vCPU, 1GB RAM, 20GB storage) | 750 hrs/month | **₹0/month** |
| **Data Transfer** | 100GB outbound | Free Tier | **₹0/month** |
| **SSL** | Certbot / Cloudflare | Free | **₹0/month** |
| **Domain** | e.g., .com | Paid (~₹800/year) | ~₹67/month |
| **Total** | | | **~₹0-67/month** |

⚠️ Free Tier is valid for **12 months** after sign-up. After that, approximate costs: **~₹1,500-2,000/month**.

---

## 📁 Files Reference

| File | Purpose |
|---|---|
| [`deploy-aws.sh`](deploy-aws.sh) | Full automated AWS deployment script |
| [`.env.example`](.env.example) | Environment variable template |
| [`server.ts`](server.ts) | Express server with health check at `/api/health` |
| [`src/db/db.ts`](src/db/db.ts) | Database connection with connection pooling |
| [`src/db/schema.ts`](src/db/schema.ts) | PostgreSQL schema (Drizzle ORM) |
| [`package.json`](package.json) | Build scripts: `npm run build` → `npm run start` |

---

**Need help?** The deploy script at [`deploy-aws.sh`](deploy-aws.sh) is self-contained and handles 90% of the setup automatically. Just set `GIT_REPO_URL` and run it.
