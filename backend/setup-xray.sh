#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  NexAura Veil — xray 1.8.x setup + API enable
#  Run once on your VPS: bash setup-xray.sh
# ─────────────────────────────────────────────────────────────
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NexAura Veil — xray setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Install / upgrade xray to latest 1.8.x
echo "[1/4] Installing xray..."
bash -c "$(curl -sL https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
XRAY_VERSION=$(/usr/local/bin/xray version 2>&1 | head -1)
echo "      ✓ $XRAY_VERSION"

# 2. Create log directory
echo "[2/4] Setting up log directory..."
mkdir -p /var/log/xray
chmod 755 /var/log/xray
echo "      ✓ /var/log/xray ready"

# 3. Write base config with API inbound enabled
echo "[3/4] Writing base xray config..."
mkdir -p /etc/xray
cat > /etc/xray/config.json << 'CONFIG'
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/xray/access.log",
    "error":  "/var/log/xray/error.log"
  },
  "api": {
    "tag": "api",
    "services": ["HandlerService", "StatsService", "LoggerService"]
  },
  "stats": {},
  "policy": {
    "levels": {
      "0": {
        "statsUserUplink": true,
        "statsUserDownlink": true
      }
    },
    "system": {
      "statsInboundUplink": true,
      "statsInboundDownlink": true
    }
  },
  "inbounds": [
    {
      "tag": "api",
      "port": 62789,
      "listen": "127.0.0.1",
      "protocol": "dokodemo-door",
      "settings": { "address": "127.0.0.1" }
    }
  ],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct", "settings": {} },
    { "protocol": "blackhole", "tag": "blocked", "settings": {} }
  ],
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      { "type": "field", "inboundTag": ["api"], "outboundTag": "api" },
      { "type": "field", "ip": ["geoip:private"], "outboundTag": "direct" }
    ]
  }
}
CONFIG
echo "      ✓ /etc/xray/config.json written"

# 4. Enable & start xray systemd service
echo "[4/4] Enabling xray service..."
systemctl enable xray
systemctl restart xray
sleep 1
STATUS=$(systemctl is-active xray)
echo "      ✓ xray service: $STATUS"

# 5. Verify API port
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Verifying xray API (port 62789)..."
sleep 1
if /usr/local/bin/xray api statsQuery --server=127.0.0.1:62789 > /dev/null 2>&1; then
  echo "  ✓ xray API is REACHABLE — Live management enabled!"
else
  echo "  ⚠ xray API not yet reachable (may need 2-3 seconds)"
  echo "    Try: xray api statsQuery --server=127.0.0.1:62789"
fi

echo ""
echo "  DONE. NexAura Veil live management is ready."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
