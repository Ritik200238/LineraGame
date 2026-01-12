#!/bin/bash
# ============================================================================
# Tower Defense on Linera - Deployment Script
# ============================================================================
# Supports both local development and Conway testnet deployment.
#
# Usage:
#   ./run.bash              # Local development
#   ./run.bash --testnet    # Deploy to Conway testnet
#
# Docker:
#   docker compose up -d --build
#   docker compose logs -f tower-defense
# ============================================================================

set -e

# ===== Configuration =====
LINERA_SERVICE_PORT=8081
FRONTEND_PORT=5173
LINERA_MAX_PENDING_MESSAGES=10000

# Conway testnet faucet
CONWAY_FAUCET="https://faucet.testnet-conway.linera.net"

# Local network settings
LOCAL_INITIAL_AMOUNT=1000000000000
LOCAL_FAUCET_PORT=8080
LOCAL_FAUCET_AMOUNT=1000000000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Parse arguments
USE_TESTNET=false
if [[ "$1" == "--testnet" || "$1" == "-t" ]]; then
    USE_TESTNET=true
fi

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ${BOLD}🏰 Tower Defense on Linera${NC}${BLUE}                            ║${NC}"
echo -e "${BLUE}║   Cooperative multiplayer tower defense game              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$USE_TESTNET" = true ]; then
    echo -e "${CYAN}Mode: Conway Testnet Deployment${NC}"
else
    echo -e "${CYAN}Mode: Local Development${NC}"
fi
echo ""

# ===== Cleanup Function =====
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    if [ ! -z "$NET_PID" ]; then
        kill $NET_PID 2>/dev/null || true
    fi
    if [ ! -z "$SERVICE_PID" ]; then
        kill $SERVICE_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Cleanup complete.${NC}"
}

trap cleanup EXIT

cd "$(dirname "$0")"

# ===== Step 1: Build =====
echo -e "${YELLOW}[1/6] Building project...${NC}"

cargo build --target wasm32-unknown-unknown --release 2>&1 | tail -5

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}\n"

# ===== Step 2: Network Setup =====
echo -e "${YELLOW}[2/6] Setting up Linera network...${NC}"

if [ "$USE_TESTNET" = true ]; then
    # Conway Testnet
    FAUCET_URL=$CONWAY_FAUCET
    echo "Using Conway testnet faucet: $FAUCET_URL"
    
    # Initialize wallet from testnet faucet
    linera --with-new-wallet wallet init --faucet "$FAUCET_URL" 2>&1 | tail -3
else
    # Local Network - run linera net up in background
    source ~/.cargo/env 2>/dev/null || true
    linera net up \
        --initial-amount $LOCAL_INITIAL_AMOUNT \
        --with-faucet \
        --faucet-port $LOCAL_FAUCET_PORT \
        --faucet-amount $LOCAL_FAUCET_AMOUNT &
    NET_PID=$!
    
    echo "Waiting for local network to start..."
    sleep 10
    
    FAUCET_URL="http://localhost:$LOCAL_FAUCET_PORT"
    
    # Wait for faucet
    for i in {1..30}; do
        if curl -s "$FAUCET_URL" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Local network started${NC}"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Network failed to start!${NC}"
            exit 1
        fi
    done
    
    # Initialize wallet
    linera --with-new-wallet wallet init --faucet "$FAUCET_URL" 2>&1 | tail -3
fi

echo -e "${GREEN}✓ Wallet initialized${NC}\n"

# ===== Step 3: Create Chains =====
echo -e "${YELLOW}[3/6] Creating chains...${NC}"

# Get default chain (master chain)
MASTER_CHAIN=$(linera --with-wallet 0 wallet show 2>/dev/null | grep "Chain ID" | head -1 | awk '{print $3}')
echo "Master Chain: $MASTER_CHAIN"

# Request game chain from faucet
linera --with-wallet 0 request-chain --faucet "$FAUCET_URL" 2>&1 | tail -2
GAME_CHAIN=$(linera --with-wallet 0 wallet show 2>/dev/null | grep "Chain ID" | tail -1 | awk '{print $3}')
echo "Game Chain: $GAME_CHAIN"

echo -e "${GREEN}✓ Chains created${NC}\n"

# ===== Step 4: Deploy Application =====
echo -e "${YELLOW}[4/6] Deploying application...${NC}"

# Create parameters JSON
PARAMS="{\"master_chain\":\"$MASTER_CHAIN\",\"public_chains\":[\"$GAME_CHAIN\"]}"
echo "Parameters: $PARAMS"

# Publish and create application
APP_OUTPUT=$(linera --with-wallet 0 project publish-and-create . \
    --json-argument "null" \
    --json-parameters "$PARAMS" 2>&1)

echo "$APP_OUTPUT" | tail -5

# Extract application ID (format: e + 64 hex + 64 hex + 16 hex)
APP_ID=$(echo "$APP_OUTPUT" | grep -oE 'e[a-f0-9]{64}[a-f0-9]{64}[a-f0-9]{16}' | head -1)

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ Failed to extract Application ID!${NC}"
    echo "Full output:"
    echo "$APP_OUTPUT"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Application deployed${NC}"
echo -e "  Application ID: ${CYAN}$APP_ID${NC}\n"

# ===== Step 5: Start Node Service =====
echo -e "${YELLOW}[5/6] Starting node service...${NC}"

linera --max-pending-message-bundles $LINERA_MAX_PENDING_MESSAGES \
    --with-wallet 0 \
    service --port $LINERA_SERVICE_PORT &
SERVICE_PID=$!

sleep 5

# Verify service is running
if curl -s "http://localhost:$LINERA_SERVICE_PORT" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Node service running on port $LINERA_SERVICE_PORT${NC}\n"
else
    echo -e "${YELLOW}⚠ Service may still be starting...${NC}\n"
fi

# ===== Step 6: Configure and Start Frontend =====
echo -e "${YELLOW}[6/6] Starting frontend...${NC}"

# Create frontend config
cat > frontend/config.json << EOF
{
    "serviceUrl": "http://localhost:$LINERA_SERVICE_PORT",
    "chainId": "$MASTER_CHAIN",
    "appId": "$APP_ID",
    "gameChain": "$GAME_CHAIN",
    "network": "$([ "$USE_TESTNET" = true ] && echo 'conway-testnet' || echo 'local')"
}
EOF

cd frontend

# Start HTTP server
if command -v http-server &> /dev/null; then
    http-server . -p $FRONTEND_PORT --cors -c0 --no-dotfiles &
    FRONTEND_PID=$!
elif command -v npx &> /dev/null; then
    npx http-server . -p $FRONTEND_PORT --cors -c0 --no-dotfiles &
    FRONTEND_PID=$!
elif command -v python3 &> /dev/null; then
    python3 -m http.server $FRONTEND_PORT &
    FRONTEND_PID=$!
else
    echo -e "${YELLOW}⚠ No HTTP server found. Please serve frontend/index.html manually.${NC}"
fi

cd ..

sleep 2
echo -e "${GREEN}✓ Frontend started on port $FRONTEND_PORT${NC}\n"

# ===== Ready! =====
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ${BOLD}🎮 TOWER DEFENSE IS READY!${NC}${GREEN}                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}         ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  ${BOLD}GraphQL Service:${NC}  ${BLUE}http://localhost:$LINERA_SERVICE_PORT${NC}"
echo -e "  ${BOLD}GraphQL Endpoint:${NC} ${BLUE}http://localhost:$LINERA_SERVICE_PORT/chains/$MASTER_CHAIN/applications/$APP_ID${NC}"
echo ""
echo -e "  ${BOLD}Chain ID:${NC}         ${CYAN}$MASTER_CHAIN${NC}"
echo -e "  ${BOLD}Application ID:${NC}   ${CYAN}$APP_ID${NC}"
echo ""

if [ "$USE_TESTNET" = true ]; then
    echo -e "  ${YELLOW}📝 Add these to your README.md for judges:${NC}"
    echo -e "     Chain ID: $MASTER_CHAIN"
    echo -e "     App ID: $APP_ID"
    echo ""
fi

echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services."
echo ""

# Wait
wait
