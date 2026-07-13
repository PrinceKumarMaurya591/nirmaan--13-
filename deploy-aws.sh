#!/bin/bash
# ============================================================
# 🚀 Thikedar App - FULL AWS CLI Deployment (Free Tier)
# ============================================================
# यह script खुद ही AWS CLI से सब कुछ create करेगी:
#   ✅ EC2 (t2.micro - Free Tier)
#   ✅ RDS PostgreSQL (db.t3.micro - Free Tier)
#   ✅ Security Groups
#   ✅ App deploy & run
#
# PREREQUISITES:
#   1. AWS CLI installed aur configured (aws configure)
#   2. GitHub repo with your code
#   3. SSH key pair (ec2-key.pem)
#
# USAGE:
#   chmod +x deploy-aws.sh
#   ./deploy-aws.sh
# ============================================================

set -euo pipefail

# ============================================================
# 🔧 CONFIGURATION - EDIT THESE VALUES
# ============================================================
AWS_REGION="ap-south-1"                   # Mumbai region (nearest to India)
AWS_ACCOUNT="029925098554"
KEY_NAME="thikedar-key"                    # EC2 key pair name
GIT_REPO_URL="https://github.com/PrinceKumarMaurya591/nirmaan--13-.git"  # <-- CHANGE THIS
DB_PASSWORD="Thikedar123!"                 # RDS password (min 8 char, must have uppercase + special char)
APP_NAME="thikedar"
DOMAIN_NAME=""                             # Optional: "thikedar.yourdomain.com"
EMAIL_FOR_SSL=""                           # Optional: "your@email.com"

# Derived names
SG_NAME="${APP_NAME}-sg"
SG_RDS_NAME="${APP_NAME}-rds-sg"
DB_INSTANCE="${APP_NAME}-db"
INSTANCE_NAME="${APP_NAME}-server"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀  Thikedar App - AWS Free Tier Deploy                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ============================================================
# STEP 0: Verify AWS CLI & permissions
# ============================================================
echo ""
echo "🔍 Step 0/9: Verifying AWS CLI..."

if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS CLI not configured! Run: aws configure"
    exit 1
fi

echo "✅ AWS CLI configured as: $(aws sts get-caller-identity --query Arn --output text)"
echo "   Region: ${AWS_REGION}"

# ============================================================
# STEP 1: Create EC2 Key Pair
# ============================================================
echo ""
echo "🔑 Step 1/9: Creating EC2 Key Pair..."

if [ ! -f "${KEY_NAME}.pem" ]; then
    aws ec2 create-key-pair \
        --key-name "${KEY_NAME}" \
        --query 'KeyMaterial' \
        --region "${AWS_REGION}" \
        --output text > "${KEY_NAME}.pem"
    chmod 400 "${KEY_NAME}.pem"
    echo "✅ Key pair created: ${KEY_NAME}.pem"
else
    echo "✅ Key pair ${KEY_NAME}.pem already exists, using it"
fi

# ============================================================
# STEP 2: Create Security Groups
# ============================================================
echo ""
echo "🔒 Step 2/9: Creating Security Groups..."

# --- Web Security Group (for EC2) ---
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${SG_NAME}" \
    --query 'SecurityGroups[0].GroupId' \
    --region "${AWS_REGION}" \
    --output text 2>/dev/null || echo "null")

if [ "$SG_ID" = "null" ] || [ -z "$SG_ID" ]; then
    SG_ID=$(aws ec2 create-security-group \
        --group-name "${SG_NAME}" \
        --description "Security group for ${APP_NAME} web server" \
        --region "${AWS_REGION}" \
        --query 'GroupId' \
        --output text)
    
    # SSH access
    aws ec2 authorize-security-group-ingress \
        --group-id "${SG_ID}" \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region "${AWS_REGION}" > /dev/null
    
    # App port (3000)
    aws ec2 authorize-security-group-ingress \
        --group-id "${SG_ID}" \
        --protocol tcp \
        --port 3000 \
        --cidr 0.0.0.0/0 \
        --region "${AWS_REGION}" > /dev/null
    
    # HTTP (for Nginx/SSL)
    aws ec2 authorize-security-group-ingress \
        --group-id "${SG_ID}" \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region "${AWS_REGION}" > /dev/null
    
    # HTTPS (for SSL)
    aws ec2 authorize-security-group-ingress \
        --group-id "${SG_ID}" \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region "${AWS_REGION}" > /dev/null
    
    echo "✅ Security Group created: ${SG_NAME} (${SG_ID})"
else
    echo "✅ Security Group ${SG_NAME} already exists: ${SG_ID}"
fi

# --- RDS Security Group ---
SG_RDS_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${SG_RDS_NAME}" \
    --query 'SecurityGroups[0].GroupId' \
    --region "${AWS_REGION}" \
    --output text 2>/dev/null || echo "null")

if [ "$SG_RDS_ID" = "null" ] || [ -z "$SG_RDS_ID" ]; then
    SG_RDS_ID=$(aws ec2 create-security-group \
        --group-name "${SG_RDS_NAME}" \
        --description "Security group for ${APP_NAME} RDS" \
        --region "${AWS_REGION}" \
        --query 'GroupId' \
        --output text)
    
    # Allow PostgreSQL from web SG only
    aws ec2 authorize-security-group-ingress \
        --group-id "${SG_RDS_ID}" \
        --protocol tcp \
        --port 5432 \
        --source-group "${SG_ID}" \
        --region "${AWS_REGION}" > /dev/null
    
    echo "✅ RDS Security Group created: ${SG_RDS_NAME} (${SG_RDS_ID})"
else
    echo "✅ RDS Security Group ${SG_RDS_NAME} already exists: ${SG_RDS_ID}"
fi

# ============================================================
# STEP 3: Create RDS PostgreSQL (Free Tier)
# ============================================================
echo ""
echo "🗄️  Step 3/9: Creating RDS PostgreSQL (Free Tier)..."

DB_EXISTS=$(aws rds describe-db-instances \
    --db-instance-identifier "${DB_INSTANCE}" \
    --region "${AWS_REGION}" \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$DB_EXISTS" = "NOT_FOUND" ]; then
    echo "⏳ Creating RDS instance (takes 5-10 minutes)..."
    
    aws rds create-db-instance \
        --db-instance-identifier "${DB_INSTANCE}" \
        --db-instance-class "db.t3.micro" \
        --engine "postgres" \
        --engine-version "16" \
        --master-username "postgres" \
        --master-user-password "${DB_PASSWORD}" \
        --allocated-storage 20 \
        --storage-type "gp2" \
        --vpc-security-group-ids "${SG_RDS_ID}" \
        --db-name "thikedar" \
        --backup-retention-period 7 \
        --deletion-protection \
        --no-publicly-accessible \
        --region "${AWS_REGION}" > /dev/null
    
    echo "⏳ Waiting for RDS to become available (this may take 5-10 minutes)..."
    aws rds wait db-instance-available \
        --db-instance-identifier "${DB_INSTANCE}" \
        --region "${AWS_REGION}"
    
    echo "✅ RDS created!"
else
    echo "✅ RDS instance already exists (status: ${DB_EXISTS})"
    if [ "$DB_EXISTS" != "available" ]; then
        echo "⏳ Waiting for RDS to become available..."
        aws rds wait db-instance-available \
            --db-instance-identifier "${DB_INSTANCE}" \
            --region "${AWS_REGION}"
    fi
fi

# Get RDS Endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "${DB_INSTANCE}" \
    --region "${AWS_REGION}" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo "   📍 RDS Endpoint: ${RDS_ENDPOINT}"

# ============================================================
# STEP 4: Get Ubuntu 22.04 Latest AMI
# ============================================================
echo ""
echo "🖼️  Step 4/9: Getting latest Ubuntu 22.04 AMI..."

UBUNTU_AMI=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --region "${AWS_REGION}" \
    --output text)

echo "   AMI: ${UBUNTU_AMI}"

# ============================================================
# STEP 5: Create EC2 Instance (t2.micro Free Tier)
# ============================================================
echo ""
echo "🖥️  Step 5/9: Creating EC2 instance (t2.micro - Free Tier)..."

INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=${INSTANCE_NAME}" \
    "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --region "${AWS_REGION}" \
    --output text 2>/dev/null || echo "null")

if [ "$INSTANCE_ID" = "null" ] || [ -z "$INSTANCE_ID" ]; then
    # Create user data script (runs on EC2 startup)
    cat > /tmp/user-data.sh << 'USERDATA'
#!/bin/bash
# This will be executed on first boot
set -e
echo "EC2 instance started - User data executed" > /home/ubuntu/startup.log
USERDATA

    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id "${UBUNTU_AMI}" \
        --instance-type "t2.micro" \
        --key-name "${KEY_NAME}" \
        --security-group-ids "${SG_ID}" \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${INSTANCE_NAME}}]" \
        --user-data file:///tmp/user-data.sh \
        --region "${AWS_REGION}" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    echo "⏳ Waiting for EC2 instance to be running..."
    aws ec2 wait instance-running \
        --instance-ids "${INSTANCE_ID}" \
        --region "${AWS_REGION}"
    
    echo "✅ EC2 instance created: ${INSTANCE_ID}"
else
    echo "✅ EC2 instance already running: ${INSTANCE_ID}"
fi

# Get EC2 Public IP
EC2_IP=$(aws ec2 describe-instances \
    --instance-ids "${INSTANCE_ID}" \
    --region "${AWS_REGION}" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "   🌐 Public IP: ${EC2_IP}"

# ============================================================
# STEP 6: Wait for EC2 to be SSH-ready
# ============================================================
echo ""
echo "⏳ Step 6/9: Waiting for EC2 to be SSH-ready..."

sleep 30  # Initial wait for SSH service to start

for i in {1..30}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "${KEY_NAME}.pem" ubuntu@"${EC2_IP}" "echo SSH_OK" 2>/dev/null; then
        echo "✅ EC2 is SSH-ready!"
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 10
done

# ============================================================
# STEP 7: Deploy App to EC2 via SSH
# ============================================================
echo ""
echo "📦 Step 7/9: Deploying application to EC2..."

# Copy files to EC2
echo "   Uploading project files..."
rsync -avz --progress \
    -e "ssh -o StrictHostKeyChecking=no -i ${KEY_NAME}.pem" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'android' \
    --exclude 'ios' \
    --exclude '*.pem' \
    ./ ubuntu@"${EC2_IP}":~/nirmaan/

# SSH and setup everything on EC2
# Pass RDS_ENDPOINT as env variable so it's available inside SSH
ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ubuntu@"${EC2_IP}" "RDS_ENDPOINT='${RDS_ENDPOINT}' DB_PASSWORD='${DB_PASSWORD}' bash -s" << 'EC2_SETUP'
    set -e
    
    echo "   📦 Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs nginx
    
    echo "   📦 Installing npm dependencies..."
    cd ~/nirmaan
    npm install
    
    echo "   📝 Creating .env file..."
    cat > .env << ENVEOF
DATABASE_URL="postgres://postgres:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/thikedar"
JWT_SECRET="thikedar-$(openssl rand -hex 16)"
NODE_ENV=production
ENVEOF
    
    echo "   🏗️  Building application..."
    npm run build
    
    echo "   🗄️  Pushing database schema..."
    npm run db:push
    
    echo "   ⚡ Installing PM2..."
    sudo npm install -g pm2
    
    echo "   🚀 Starting application..."
    pm2 delete thikedar 2>/dev/null || true
    NODE_ENV=production pm2 start dist/server.cjs --name thikedar
    pm2 save
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
    
    echo "✅ EC2 setup complete!"
EC2_SETUP

echo "✅ Application deployed!"

# ============================================================
# STEP 8: Setup Nginx + SSL (if domain provided)
# ============================================================
if [ -n "$DOMAIN_NAME" ] && [ -n "$EMAIL_FOR_SSL" ]; then
    echo ""
    echo "🌐 Step 8/9: Setting up Nginx + SSL for ${DOMAIN_NAME}..."
    
    ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ubuntu@"${EC2_IP}" << NGINX_SETUP
        sudo tee /etc/nginx/sites-available/thikedar > /dev/null << 'NGINX'
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
        sudo ln -sf /etc/nginx/sites-available/thikedar /etc/nginx/sites-enabled/
        sudo rm -f /etc/nginx/sites-enabled/default
        sudo nginx -t && sudo systemctl reload nginx
        
        sudo certbot --nginx -d ${DOMAIN_NAME} --non-interactive --agree-tos -m ${EMAIL_FOR_SSL}
NGINX_SETUP
    
    echo "✅ SSL configured!"
    APP_URL="https://${DOMAIN_NAME}"
else
    APP_URL="http://${EC2_IP}:3000"
fi

# ============================================================
# STEP 9: Test & Verify
# ============================================================
echo ""
echo "🔍 Step 9/9: Verifying deployment..."

sleep 10
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${EC2_IP}:3000" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "302" ] || [ "$HTTP_STATUS" = "301" ]; then
    echo "✅ App is responding! (HTTP ${HTTP_STATUS})"
else
    echo "⚠️  App might still be starting... status: ${HTTP_STATUS}"
    echo "   Check manually: http://${EC2_IP}:3000"
fi

# ============================================================
# 🎉 COMPLETION SUMMARY
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     ✅  DEPLOYMENT COMPLETE!                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "   📍 App URL:        ${APP_URL}"
echo "   🖥️  EC2 IP:        ${EC2_IP}"
echo "   🗄️  RDS Endpoint:  ${RDS_ENDPOINT}"
echo "   🔑 SSH Key:       ${KEY_NAME}.pem"
echo ""
echo "   📋 SSH Command:"
echo "   ssh -i ${KEY_NAME}.pem ubuntu@${EC2_IP}"
echo ""
echo "   📋 Useful Commands:"
echo "   pm2 status             → App status check"
echo "   pm2 logs thikedar      → Logs देखने के लिए"
echo "   pm2 restart thikedar   → App restart"
echo ""
echo "   🔄 New version deploy:"
echo "   cd ~/nirmaan && git pull && npm install && npm run build && pm2 restart thikedar"
echo ""
echo "   💰 Cost:"
echo "   EC2 t2.micro   → Free Tier (750 hrs/month)"
echo "   RDS db.t3.micro → Free Tier (750 hrs/month)"
echo "   Total: ~₹0/month (Free Tier में)"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - RDS deletion protection is ON (manually disable to delete)"
echo "   - Free Tier 12 months के लिए valid है"
echo "   - 750 hrs/month = 1 instance 24x7 चला सकते हैं"
echo ""

# Save info to file
cat > deployment-info.txt << EOF
=== ${APP_NAME} Deployment Info ===
App URL:        ${APP_URL}
EC2 IP:         ${EC2_IP}
EC2 Instance:   ${INSTANCE_ID}
RDS Endpoint:   ${RDS_ENDPOINT}
RDS Instance:   ${DB_INSTANCE}
SSH Key:        ${KEY_NAME}.pem
Region:         ${AWS_REGION}
Deployed:       $(date)
EOF

echo "📄 Details saved to: deployment-info.txt"
echo "🎉 Done!"
