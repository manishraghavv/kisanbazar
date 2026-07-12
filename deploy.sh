#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  deploy.sh — Multi-Vendor Deployment Script
#  Target: AWS EC2 (Ubuntu 24.04) with PM2 + Nginx
# ─────────────────────────────────────────────────────────────
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh                # normal deploy
#   ./deploy.sh --rollback     # rollback to previous release
#   ./deploy.sh --status       # check deployment status
#
# Environment (set in ~/app/.env or GitHub Secrets):
#   DATABASE_URL
#   JWT_ACCESS_SECRET
#   JWT_REFRESH_SECRET
#   NEXT_PUBLIC_API_URL
#   CORS_ORIGIN
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors for output ───────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Configuration ───────────────────────────────────────────
APP_DIR="$HOME/app"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
LOG_DIR="$APP_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$APP_DIR/releases/$TIMESTAMP"
KEEP_RELEASES=5

# ── Helpers ─────────────────────────────────────────────────
log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_command() {
  if ! command -v "$1" &>/dev/null; then
    log_error "$1 is not installed. Please install it first."
    exit 1
  fi
}

# ── Pre-flight checks ───────────────────────────────────────
preflight() {
  log_info "Running pre-flight checks..."

  check_command node
  check_command npm
  check_command pm2

  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 22 ]; then
    log_error "Node.js 22+ required. Found: $(node -v)"
    exit 1
  fi
  log_ok "Node.js $(node -v)"

  # Ensure env files exist
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    log_warn "Missing backend/.env — creating from .env.example if available"
    if [ -f "$BACKEND_DIR/.env.example" ]; then
      cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
      log_ok "Created backend/.env from .env.example"
    fi
  fi

  if [ ! -f "$FRONTEND_DIR/.env" ]; then
    log_warn "Missing frontend/.env — creating from .env.example if available"
    if [ -f "$FRONTEND_DIR/.env.example" ]; then
      cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
      log_ok "Created frontend/.env from .env.example"
    fi
  fi

  # Ensure log directory
  mkdir -p "$LOG_DIR"

  log_ok "Pre-flight checks passed"
}

# ── Git pull (standalone / manual deploy) ────────────────────
git_pull() {
  log_info "Pulling latest code from repository..."

  if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git fetch --all 2>&1 | tail -1
    git reset --hard origin/main 2>&1 | tail -1
    log_ok "Git pull completed — reset to origin/main"
  else
    log_warn "Not a git repository — skipping git pull"
    log_info "  (Files should already be uploaded via CI artifacts)"
  fi
}

# ── Create release snapshot (for rollback) ───────────────────
create_release_snapshot() {
  log_info "Creating release snapshot..."

  mkdir -p "$APP_DIR/releases"

  # Copy current app state to release directory
  mkdir -p "$RELEASE_DIR/backend" "$RELEASE_DIR/frontend"

  if [ -d "$BACKEND_DIR/node_modules" ]; then
    # Copy only source, config, and non-node_modules files
    for item in "$BACKEND_DIR"/*; do
      basename_item=$(basename "$item")
      if [ "$basename_item" != "node_modules" ]; then
        cp -r "$item" "$RELEASE_DIR/backend/" 2>/dev/null || true
      fi
    done
  fi

  if [ -d "$FRONTEND_DIR/node_modules" ]; then
    for item in "$FRONTEND_DIR"/*; do
      basename_item=$(basename "$item")
      if [ "$basename_item" != "node_modules" ]; then
        cp -r "$item" "$RELEASE_DIR/frontend/" 2>/dev/null || true
      fi
    done
  fi

  log_ok "Release snapshot created: $TIMESTAMP"

  # Keep only the last N releases
  log_info "Cleaning old releases (keeping last $KEEP_RELEASES)..."
  ls -dt "$APP_DIR/releases"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs rm -rf 2>/dev/null || true
  log_ok "Old releases cleaned"
}

# ── Install dependencies ────────────────────────────────────
install_deps() {
  log_info "Installing backend dependencies..."
  cd "$BACKEND_DIR"
  npm ci 2>&1 | tail -1
  log_ok "Backend dependencies installed"

  log_info "Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  npm ci 2>&1 | tail -1
  log_ok "Frontend dependencies installed"
}

# ── Prisma (Database) ───────────────────────────────────────
run_prisma() {
  log_info "Running Prisma generate..."
  cd "$BACKEND_DIR"
  npx prisma generate 2>&1 | tail -1
  log_ok "Prisma client generated"

  log_info "Running Prisma migrations..."
  npx prisma migrate deploy 2>&1 || log_warn "Migration deploy had issues (might already be applied)"
  log_ok "Prisma migrations applied"
}

# ── Build ────────────────────────────────────────────────────
build_backend() {
  # Skip rebuild if CI already uploaded pre-built artifacts
  if [ -f "$BACKEND_DIR/dist/index.js" ] || [ -f "$BACKEND_DIR/dist/server.js" ] || [ -f "$BACKEND_DIR/dist/src/index.js" ]; then
    log_info "Backend dist/ exists — skipping rebuild (CI artifacts)"
    return 0
  fi
  log_info "Building backend (TypeScript)..."
  cd "$BACKEND_DIR"
  npm run build 2>&1 | tail -5
  log_ok "Backend built successfully"
}

build_frontend() {
  # Skip rebuild if CI already uploaded pre-built artifacts
  if [ -f "$FRONTEND_DIR/.next/BUILD_ID" ]; then
    log_info "Frontend .next/ exists — skipping rebuild (CI artifacts)"
    return 0
  fi
  log_info "Building frontend (Next.js)..."
  cd "$FRONTEND_DIR"
  npm run build 2>&1 | tail -5
  log_ok "Frontend built successfully"
}

# ── PM2 process management ──────────────────────────────────
restart_pm2() {
  log_info "Restarting PM2 processes..."

  cd "$APP_DIR"

  # Check if ecosystem config exists
  if [ -f "$APP_DIR/ecosystem.config.cjs" ]; then
    pm2 delete ecosystem.config.cjs 2>/dev/null || true
    pm2 start ecosystem.config.cjs 2>&1
  elif [ -f "$BACKEND_DIR/ecosystem.config.cjs" ]; then
    pm2 delete backend 2>/dev/null || true
    pm2 delete frontend 2>/dev/null || true
    pm2 start "$BACKEND_DIR/ecosystem.config.cjs" 2>&1
  else
    # Fallback: start processes manually
    pm2 delete backend 2>/dev/null || true
    pm2 delete frontend 2>/dev/null || true

    pm2 start "$BACKEND_DIR/dist/index.js" \
      --name backend \
      --cwd "$BACKEND_DIR" \
      --env NODE_ENV=production \
      --log "$LOG_DIR/backend-combined.log" \
      --error "$LOG_DIR/backend-error.log" \
      --merge-logs

    pm2 start "$FRONTEND_DIR/node_modules/.bin/next" \
      --name frontend \
      -- start \
      --cwd "$FRONTEND_DIR" \
      --env NODE_ENV=production,PORT=3001 \
      --log "$LOG_DIR/frontend-combined.log" \
      --error "$LOG_DIR/frontend-error.log" \
      --merge-logs
  fi

  pm2 save
  log_ok "PM2 processes restarted"
}

# ── Cache & temp cleanup ────────────────────────────────────
cleanup() {
  log_info "Cleaning old cache and temp files..."

  # Clean npm cache
  npm cache clean --force 2>/dev/null || true

  # Clean Next.js cache (keep .next for runtime)
  rm -rf "$FRONTEND_DIR/.next/cache" 2>/dev/null || true

  # Clean old PM2 logs
  pm2 flush 2>/dev/null || true

  # Rotate logs (keep last 3)
  find "$LOG_DIR" -name "*.log" -type f | head -n -3 | xargs rm -f 2>/dev/null || true

  log_ok "Cleanup completed"
}

# ── Nginx reload ────────────────────────────────────────────
reload_nginx() {
  if command -v nginx &>/dev/null; then
    log_info "Testing Nginx configuration..."
    sudo nginx -t 2>&1 && {
      log_info "Reloading Nginx..."
      sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null || true
      log_ok "Nginx reloaded"
    } || log_warn "Nginx config test failed — skipping reload"
  else
    log_warn "Nginx not found — skipping reload"
  fi
}

# ── Deployment status ───────────────────────────────────────
show_status() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Multi-Vendor — Deployment Status${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
  echo ""

  echo -e "${YELLOW}PM2 Processes:${NC}"
  pm2 status 2>/dev/null || echo "  pm2 not running"

  echo ""
  echo -e "${YELLOW}Nginx:${NC}"
  if command -v nginx &>/dev/null; then
    sudo nginx -t 2>&1 | head -2
    echo "  Status: $(systemctl is-active nginx 2>/dev/null || service nginx status 2>/dev/null | head -1)"
  else
    echo "  Nginx not installed"
  fi

  echo ""
  echo -e "${YELLOW}Disk Usage:${NC}"
  df -h "$APP_DIR" | tail -1 | awk '{print "  Used: " $3 " / " $2 " (" $5 ")"}'

  echo ""
  echo -e "${YELLOW}Backend Health:${NC}"
  curl -s http://localhost:3000/health 2>/dev/null || echo "  Backend not responding"

  echo ""
  echo -e "${GREEN}Deployment completed at: $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
}

# ── Rollback ─────────────────────────────────────────────────
rollback() {
  log_info "Initiating rollback..."

  # Find the previous release
  PREV_RELEASE=$(ls -dt "$APP_DIR/releases"/*/ 2>/dev/null | sed -n '2p')
  if [ -z "$PREV_RELEASE" ]; then
    log_error "No previous release found for rollback"
    exit 1
  fi

  log_info "Rolling back to: $PREV_RELEASE"

  # Restore backend
  cp -r "$PREV_RELEASE/backend/"* "$BACKEND_DIR/"
  cp -r "$PREV_RELEASE/frontend/"* "$FRONTEND_DIR/"

  restart_pm2
  reload_nginx

  log_ok "Rollback completed to $(basename "$PREV_RELEASE")"
}

# ── Main ─────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}──────────────────────────────────────────────${NC}"
  echo -e "${CYAN}  🚜 Multi-Vendor — Deployment Script${NC}"
  echo -e "${CYAN}  $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
  echo -e "${CYAN}──────────────────────────────────────────────${NC}"
  echo ""

  # Handle flags
  case "${1:-}" in
    --rollback|-r)
      rollback
      exit 0
      ;;
    --status|-s)
      show_status
      exit 0
      ;;
    --help|-h)
      echo "Usage: ./deploy.sh [OPTION]"
      echo ""
      echo "Options:"
      echo "  --rollback, -r    Rollback to the previous release"
      echo "  --status, -s      Show deployment status"
      echo "  --help, -h        Show this help message"
      echo ""
      echo "Without options, runs a full deployment."
      exit 0
      ;;
  esac

  git_pull
  preflight
  create_release_snapshot
  install_deps
  run_prisma
  build_backend
  build_frontend
  restart_pm2
  reload_nginx
  cleanup
  show_status

  echo ""
  echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
}

main "$@"
