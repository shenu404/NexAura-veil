<div align="center">

<br/>

```
 ███╗   ██╗███████╗██╗  ██╗ █████╗ ██╗   ██╗██████╗  █████╗ 
 ████╗  ██║██╔════╝╚██╗██╔╝██╔══██╗██║   ██║██╔══██╗██╔══██╗
 ██╔██╗ ██║█████╗   ╚███╔╝ ███████║██║   ██║██████╔╝███████║
 ██║╚██╗██║██╔══╝   ██╔██╗ ██╔══██║██║   ██║██╔══██╗██╔══██║
 ██║ ╚████║███████╗██╔╝ ██╗██║  ██║╚██████╔╝██║  ██║██║  ██║
 ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
                          V E I L
```

**A sleek, self-hosted proxy management panel built on Xray-core**

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Xray](https://img.shields.io/badge/Xray--core-latest-8040ff?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)

*Designed & Developed by **Shenu** · Powered by **NexAura™** · © 2026*

</div>

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 **Auth** | JWT-based secure admin login |
| 📡 **Inbound Management** | VLESS · VMESS · Trojan · Shadowsocks |
| 👥 **Client Management** | Multi-inbound, traffic limits, expiry auto-disable |
| 🔗 **Subscription Links** | v2rayN · Clash · Hiddify · Shadowrocket compatible |
| 📊 **Traffic Stats** | Real-time polling, hourly logs, per-client usage |
| 🚫 **IP Enforcement** | Strict single-IP per config — auto ban on violation |
| 📋 **Event Log** | Live feed: connect · disconnect · ban · unban |
| 🛡️ **Manual Ban/Unban** | Admin-controlled client blocking from dashboard |
| ⚡ **Hot Reload** | SIGUSR1 signal — zero-downtime config updates |
| 🎨 **Dark UI** | Glassmorphism design, animated loading screen |

---

## 🖥️ Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20 + Express + SQLite |
| Frontend | React 18 + Vite + Tailwind CSS |
| Proxy Core | Xray-core (XTLS) |
| Process Manager | PM2 |
| Web Server | Nginx + Let's Encrypt SSL |

---

## 🚀 One-Command Deploy

```bash
bash <(curl -Ls https://raw.githubusercontent.com/shenu404/nexaura-veil/main/install.sh)
```
That's it — the script handles everything below automatically.

The deploy script handles:
- Node.js 20 install
- Xray-core install
- Backend dependencies + auto JWT secret generation
- Frontend build
- Nginx config + SSL (Let's Encrypt)
- PM2 process management + auto-start on reboot
- UFW firewall rules

---

## 🛠️ Manual Setup

### Requirements
- Ubuntu 20.04+ / Debian 11+
- Node.js 18+
- A domain pointing to your VPS

### Step 1 — Clone
```bash
git clone https://github.com/shenu404/nexaura-veil.git /opt/nexaura-veil
cd /opt/nexaura-veil
```

### Step 2 — Xray
```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

### Step 3 — Backend
```bash
cd backend
npm install
cp .env.example .env
nano .env   # Set JWT_SECRET + FRONTEND_URL
npm start
```

### Step 4 — Frontend
```bash
cd ../frontend
npm install
npm run build
```

### Step 5 — PM2
```bash
npm install -g pm2
cd ../backend
pm2 start src/index.js --name nexaura-veil
pm2 save && pm2 startup
```

### Step 6 — Nginx + SSL
```bash
# Copy nginx.conf → /etc/nginx/sites-available/nexaura-veil
# Edit: replace YOUR_DOMAIN with your domain
sudo ln -s /etc/nginx/sites-available/nexaura-veil /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🔑 Default Login

| | |
|---|---|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ **Change your password immediately after first login!**

---

## 📡 Supported Protocols

| Protocol | Reality | TLS | WS | gRPC | TCP |
|---|---|---|---|---|---|
| VLESS | ✅ | ✅ | ✅ | ✅ | ✅ |
| VMESS | — | ✅ | ✅ | ✅ | ✅ |
| Trojan | — | ✅ | ✅ | ✅ | ✅ |
| Shadowsocks | — | — | — | — | ✅ |

---

## ⚙️ PM2 Commands

```bash
pm2 status                    # Panel status
pm2 logs nexaura-veil         # Live logs
pm2 restart nexaura-veil      # Restart
pm2 stop nexaura-veil         # Stop
```

---

## 🔒 IP Limit System

Veil enforces a **strict single-IP policy** per client config:

```
Client connects       → IP locked for that client
Same IP reconnects    → ✅ Allowed (same device)
Different IP connects → 🚫 Auto-banned for 1 hour
IP silent 30+ min     → ✅ New IP allowed (network switch)
After 1 hour          → ✅ Auto-unbanned
Admin manual ban/unban → Available from dashboard
```

---

<div align="center">
<br/>

**NexAura Veil** — Built different.

*Powered by **NexAura™** · Designed by **Shenu** · © 2026*

</div>
