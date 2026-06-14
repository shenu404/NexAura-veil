#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  NexAura Veil — VPS Deploy Script
#  Powered by NexAura™ · Designed by Shenu · © 2026
#
#  Usage:
#    sudo ./deploy.sh                        # interactive
#    sudo ./deploy.sh -d vpn.example.com     # non-interactive
#    sudo ./deploy.sh -d vpn.example.com -p 4000 -i /opt/nexaura-veil
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'
P='\033[0;35m'; C='\033[0;36m'; W='\033[1;37m'; N='\033[0m'

log()  { echo -e "${C}[Veil]${N} $1"; }
ok()   { echo -e "${G}  ✓${N}  $1"; }
warn() { echo -e "${Y}  !${N}  $1"; }
err()  { echo -e "${R}  ✗${N}  $1"; exit 1; }
hdr()  { echo -e "\n${P}── $1 ──${N}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${P}"
cat << 'BANNER'
  ███╗   ██╗███████╗██╗  ██╗ █████╗ ██╗   ██╗██████╗  █████╗ 
  ████╗  ██║██╔════╝╚██╗██╔╝██╔══██╗██║   ██║██╔══██╗██╔══██╗
  ██╔██╗ ██║█████╗   ╚███╔╝ ███████║██║   ██║██████╔╝███████║
  ██║╚██╗██║██╔══╝   ██╔██╗ ██╔══██║██║   ██║██╔══██╗██╔══██║
  ██║ ╚████║███████╗██╔╝ ██╗██║  ██║╚██████╔╝██║  ██║██║  ██║
  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
                            V E I L
BANNER
echo -e "${N}  ${W}Proxy Management Panel${N} · Powered by ${P}NexAura™${N} · by ${P}Shenu${N} · © 2026"
echo ""

# ── Defaults ──────────────────────────────────────────────────────────────────
DOMAIN=""
PORT=4000
INSTALL_DIR="/opt/nexaura-veil"
SKIP_SSL=false
ADMIN_EMAIL=""

# ── Arg parse ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    -d|--domain)      DOMAIN="$2";      shift 2 ;;
    -p|--port)        PORT="$2";        shift 2 ;;
    -i|--install-dir) INSTALL_DIR="$2"; shift 2 ;;
    -e|--email)       ADMIN_EMAIL="$2"; shift 2 ;;
    --skip-ssl)       SKIP_SSL=true;    shift   ;;
    -h|--help)
      echo "Usage: sudo ./deploy.sh [OPTIONS]"
      echo ""
      echo "  -d, --domain       Your domain (e.g. panel.example.com)"
      echo "  -p, --port         Backend port (default: 4000)"
      echo "  -i, --install-dir  Install path (default: /opt/nexaura-veil)"
      echo "  -e, --email        Email for SSL certificate"
      echo "      --skip-ssl     Skip SSL setup"
      echo ""
      exit 0 ;;
    *) warn "Unknown option: $1"; shift ;;
  esac
done

# ── Root check ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Please run as root: sudo ./deploy.sh"

# ── Interactive config ────────────────────────────────────────────────────────
hdr "Configuration"

if [[ -z "$DOMAIN" ]]; then
  read -rp "  Domain (e.g. panel.example.com): " DOMAIN
  [[ -z "$DOMAIN" ]] && err "Domain is required"
fi

if [[ -z "$ADMIN_EMAIL" && "$SKIP_SSL" == "false" ]]; then
  read -rp "  Email for SSL certificate: " ADMIN_EMAIL
  [[ -z "$ADMIN_EMAIL" ]] && SKIP_SSL=true && warn "No email — skipping SSL"
fi

read -rp "  Backend port [${PORT}]: " _PORT
PORT="${_PORT:-$PORT}"

read -rp "  Install directory [${INSTALL_DIR}]: " _DIR
INSTALL_DIR="${_DIR:-$INSTALL_DIR}"

echo ""
echo -e "  ${W}Domain:${N}      ${DOMAIN}"
echo -e "  ${W}Port:${N}        ${PORT}"
echo -e "  ${W}Install dir:${N} ${INSTALL_DIR}"
echo -e "  ${W}SSL:${N}         $( [[ $SKIP_SSL == true ]] && echo 'Skip' || echo "Let's Encrypt (${ADMIN_EMAIL})" )"
echo ""
read -rp "  Confirm and start deploy? [Y/n]: " CONFIRM
[[ "${CONFIRM,,}" == "n" ]] && echo "Aborted." && exit 0

# ── System packages ───────────────────────────────────────────────────────────
hdr "System"
log "Updating package lists..."
apt-get update -qq

log "Installing dependencies..."
apt-get install -y -qq curl wget unzip nginx ufw \
  certbot python3-certbot-nginx openssl 2>/dev/null
ok "System packages ready"

# ── Node.js ───────────────────────────────────────────────────────────────────
hdr "Node.js"
NODE_VER=0
command -v node &>/dev/null && NODE_VER=$(node -v | cut -d. -f1 | tr -d 'v')
if [[ $NODE_VER -lt 18 ]]; then
  log "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
fi
ok "Node.js $(node -v)"

# ── PM2 ───────────────────────────────────────────────────────────────────────
command -v pm2 &>/dev/null || npm install -g pm2 --silent
ok "PM2 $(pm2 -v)"

# ── Xray-core ─────────────────────────────────────────────────────────────────
hdr "Xray-core"
if ! command -v /usr/local/bin/xray &>/dev/null; then
  log "Installing Xray-core..."
  bash -c "$(curl -sL https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install >/dev/null 2>&1
fi
ok "Xray $(/usr/local/bin/xray version 2>/dev/null | head -1 | awk '{print $2}')"

mkdir -p /var/log/xray
touch /var/log/xray/access.log /var/log/xray/error.log
chmod 644 /var/log/xray/access.log /var/log/xray/error.log

# Initial xray config if none
if [[ ! -f /etc/xray/config.json ]]; then
  mkdir -p /etc/xray
  cat > /etc/xray/config.json << 'XRAYCFG'
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/xray/access.log",
    "error":  "/var/log/xray/error.log"
  },
  "api": {
    "tag": "api",
    "services": ["HandlerService","LoggerService","StatsService"]
  },
  "stats": {},
  "policy": {
    "levels": {"0": {"statsUserUplink":true,"statsUserDownlink":true}},
    "system": {"statsInboundUplink":true,"statsInboundDownlink":true}
  },
  "inbounds": [{
    "tag":"api","port":62789,"listen":"127.0.0.1",
    "protocol":"dokodemo-door","settings":{"address":"127.0.0.1"}
  }],
  "outbounds": [
    {"protocol":"freedom","tag":"direct","settings":{}},
    {"protocol":"blackhole","tag":"blocked","settings":{}}
  ],
  "routing": {
    "domainStrategy":"IPIfNonMatch",
    "rules":[{"type":"field","inboundTag":["api"],"outboundTag":"api"}]
  }
}
XRAYCFG
fi
systemctl enable xray >/dev/null 2>&1
systemctl restart xray >/dev/null 2>&1 || warn "Xray could not start — add inbounds first"
ok "Xray configured"

# ── Deploy files ──────────────────────────────────────────────────────────────
hdr "Application"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log "Deploying to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"
rsync -a --exclude='node_modules' --exclude='.git' \
  --exclude='frontend/dist' --exclude='backend/data/*.db' \
  "$SCRIPT_DIR/" "$INSTALL_DIR/" 2>/dev/null \
  || cp -r "$SCRIPT_DIR/." "$INSTALL_DIR/"
ok "Files deployed"

# ── Backend ───────────────────────────────────────────────────────────────────
hdr "Backend"
cd "$INSTALL_DIR/backend"
log "Installing backend dependencies..."
npm install --production --silent
mkdir -p data logs

JWT_SECRET=$(openssl rand -hex 32)
cat > .env << ENVEOF
# NexAura Veil — generated by deploy.sh
PORT=${PORT}
FRONTEND_URL=https://${DOMAIN}
JWT_SECRET=${JWT_SECRET}
DB_PATH=./data/nexaura.db
XRAY_PATH=/usr/local/bin/xray
XRAY_CONFIG_PATH=/etc/xray/config.json
XRAY_API_ADDR=127.0.0.1:62789
XRAY_API_PORT=62789
XRAY_ACCESS_LOG=/var/log/xray/access.log
XRAY_ERROR_LOG=/var/log/xray/error.log
ENVEOF
ok "Backend configured (JWT auto-generated)"

# ── Frontend ──────────────────────────────────────────────────────────────────
hdr "Frontend"
cd "$INSTALL_DIR/frontend"
log "Installing frontend dependencies..."
npm install --silent
log "Building..."
npm run build
ok "Frontend built → dist/"

# ── Nginx ─────────────────────────────────────────────────────────────────────
hdr "Nginx"
NGINX_CONF="/etc/nginx/sites-available/nexaura-veil"
cat > "$NGINX_CONF" << NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${INSTALL_DIR}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    location /sub/ {
        proxy_pass       http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/nexaura-veil
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && systemctl reload nginx
ok "Nginx configured"

# ── SSL ───────────────────────────────────────────────────────────────────────
if [[ "$SKIP_SSL" == "false" ]]; then
  hdr "SSL"
  log "Requesting certificate for ${DOMAIN}..."
  certbot --nginx -d "$DOMAIN" \
    --non-interactive --agree-tos \
    --email "$ADMIN_EMAIL" \
    --redirect >/dev/null 2>&1 \
    && ok "SSL certificate installed (auto-renew enabled)" \
    || warn "SSL failed — run manually: certbot --nginx -d ${DOMAIN}"
else
  warn "SSL skipped — panel will run on HTTP"
fi

# ── PM2 ───────────────────────────────────────────────────────────────────────
hdr "Process Manager"
cd "$INSTALL_DIR/backend"
pm2 stop nexaura-veil 2>/dev/null || true
pm2 start src/index.js \
  --name nexaura-veil \
  --time \
  --log "$INSTALL_DIR/backend/logs/pm2.log" \
  --error "$INSTALL_DIR/backend/logs/pm2-error.log"
pm2 save >/dev/null 2>&1
# Register startup script
PM2_STARTUP=$(pm2 startup 2>/dev/null | grep "sudo" | tail -1 || true)
[[ -n "$PM2_STARTUP" ]] && eval "$PM2_STARTUP" >/dev/null 2>&1 || true
ok "PM2 running (auto-start on reboot enabled)"

# ── Firewall ──────────────────────────────────────────────────────────────────
hdr "Firewall"
ufw allow 22/tcp  >/dev/null 2>&1
ufw allow 80/tcp  >/dev/null 2>&1
ufw allow 443/tcp >/dev/null 2>&1
ufw --force enable >/dev/null 2>&1
ok "UFW: 22, 80, 443 open"

# ── Done ──────────────────────────────────────────────────────────────────────
PROTO=$( [[ $SKIP_SSL == false ]] && echo "https" || echo "http" )
echo ""
echo -e "${P}╔══════════════════════════════════════════════════════╗${N}"
echo -e "${P}║${N}   ${G}✓ NexAura Veil deployed successfully!${N}              ${P}║${N}"
echo -e "${P}╠══════════════════════════════════════════════════════╣${N}"
echo -e "${P}║${N}                                                      ${P}║${N}"
echo -e "${P}║${N}   ${W}Panel URL:${N}   ${C}${PROTO}://${DOMAIN}${N}"
echo -e "${P}║${N}   ${W}Username:${N}    admin                                ${P}║${N}"
echo -e "${P}║${N}   ${W}Password:${N}    admin123                             ${P}║${N}"
echo -e "${P}║${N}                                                      ${P}║${N}"
echo -e "${P}║${N}   ${Y}⚠  Change password immediately after login!${N}      ${P}║${N}"
echo -e "${P}║${N}                                                      ${P}║${N}"
echo -e "${P}╠══════════════════════════════════════════════════════╣${N}"
echo -e "${P}║${N}   ${W}PM2 logs:${N}    pm2 logs nexaura-veil               ${P}║${N}"
echo -e "${P}║${N}   ${W}Restart:${N}     pm2 restart nexaura-veil             ${P}║${N}"
echo -e "${P}║${N}   ${W}Update:${N}      git pull && npm run build (frontend) ${P}║${N}"
echo -e "${P}║${N}                                                      ${P}║${N}"
echo -e "${P}╠══════════════════════════════════════════════════════╣${N}"
echo -e "${P}║${N}   Powered by ${P}NexAura™${N} · Designed by ${P}Shenu${N} · © 2026  ${P}║${N}"
echo -e "${P}╚══════════════════════════════════════════════════════╝${N}"
echo ""
