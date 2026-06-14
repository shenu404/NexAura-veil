#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  NexAura Veil — One-Line Installer
#  Usage: bash <(curl -Ls https://raw.githubusercontent.com/shenu404/nexaura-veil/main/install.sh)
#  Powered by NexAura™ · Designed by Shenu · © 2026
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'
P='\033[0;35m'; C='\033[0;36m'; W='\033[1;37m'; N='\033[0m'

log()  { echo -e "${C}[Veil]${N} $1"; }
ok()   { echo -e "${G}  ✓${N}  $1"; }
warn() { echo -e "${Y}  !${N}  $1"; }
err()  { echo -e "${R}  ✗${N}  $1"; exit 1; }

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

# ── Root check ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Run as root: sudo bash <(curl -Ls ...)"

# ── OS check ─────────────────────────────────────────────────────────────────
if [[ ! -f /etc/os-release ]]; then
  err "Cannot detect OS. Ubuntu 20.04+ / Debian 11+ required."
fi
. /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
  err "Unsupported OS: $PRETTY_NAME. Ubuntu/Debian required."
fi
ok "OS: $PRETTY_NAME"

# ── Deps ──────────────────────────────────────────────────────────────────────
log "Installing base dependencies..."
apt-get update -qq
apt-get install -y -qq git curl wget unzip openssl 2>/dev/null
ok "Base dependencies ready"

# ── Clone / Update ────────────────────────────────────────────────────────────
REPO="https://github.com/shenu404/nexaura-veil.git"
TMP_DIR="/tmp/nexaura-veil-install"

log "Fetching NexAura Veil..."
rm -rf "$TMP_DIR"
git clone --depth=1 "$REPO" "$TMP_DIR" 2>/dev/null || err "Failed to fetch source from $REPO — check the repo URL / that it's public"
ok "Source fetched"

# ── Hand off to deploy.sh ─────────────────────────────────────────────────────
chmod +x "$TMP_DIR/deploy.sh"
exec bash "$TMP_DIR/deploy.sh" "$@"
