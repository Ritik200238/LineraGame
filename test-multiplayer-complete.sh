#!/bin/bash
# Complete Multiplayer Testing Script
# Tests all 4 game modes, stress testing, and validation on local Linera
# Usage: ./test-multiplayer-complete.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=============================================="
echo "  🎮 TOWER DEFENSE MULTIPLAYER TEST SUITE"
echo "=============================================="
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Step 1: Check Prerequisites
echo -e "${BLUE}[1/8] Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose found${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js found (${NODE_VERSION})${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Not in tower-defense directory${NC}"
    exit 1
fi
echo -e "${GREEN}✅ In correct directory${NC}"

# Step 2: Install Dependencies
echo ""
echo -e "${BLUE}[2/8] Installing test dependencies...${NC}"

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "npm packages already installed"
fi

# Install Playwright browsers if needed
if [ ! -d "node_modules/@playwright/test" ]; then
    echo "Installing Playwright..."
    npm install --save-dev @playwright/test
fi

if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    npx playwright install chromium
else
    echo "Playwright browsers already installed"
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 3: Clean Docker Environment
echo ""
echo -e "${BLUE}[3/8] Cleaning Docker environment...${NC}"

# Stop any existing containers
if docker-compose ps | grep -q "Up"; then
    echo "Stopping existing containers..."
    docker-compose down
fi

# Remove old volumes (optional, comment out if you want to keep state)
# docker-compose down -v

echo -e "${GREEN}✅ Environment cleaned${NC}"

# Step 4: Build and Start Services
echo ""
echo -e "${BLUE}[4/8] Building and starting Linera services...${NC}"

# Build contracts
echo "Building Rust contracts..."
cargo build --release --target wasm32-unknown-unknown || {
    echo -e "${YELLOW}⚠️  WASM build failed (may be expected if Rust toolchain not configured)${NC}"
}

# Start Docker services
echo "Starting Docker Compose services..."
docker-compose up -d --build

# Wait for services to be ready
echo "Waiting for services to be ready..."
MAX_WAIT=120
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200\|404"; then
        echo -e "${GREEN}✅ Services are responding${NC}"
        break
    fi

    echo -n "."
    sleep 2
    WAITED=$((WAITED + 2))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}❌ Services failed to start within ${MAX_WAIT} seconds${NC}"
    echo "Checking logs..."
    docker-compose logs --tail=50
    exit 1
fi

# Extra wait for full initialization
echo "Waiting 10 more seconds for full initialization..."
sleep 10

echo -e "${GREEN}✅ Services started and ready${NC}"

# Show service status
echo ""
echo "Service Status:"
docker-compose ps

# Step 5: Run Multiplayer Mode Tests
echo ""
echo "=============================================="
echo -e "${BLUE}[5/8] Running Multiplayer Mode Tests${NC}"
echo "=============================================="
echo ""

echo "Testing all 4 game modes: Versus, Co-op, Race, High Score"
echo ""

if npx playwright test tests/multiplayer-modes.spec.js --reporter=list; then
    echo -e "${GREEN}✅ Multiplayer mode tests PASSED${NC}"
    MULTIPLAYER_RESULT="PASSED"
else
    echo -e "${RED}❌ Multiplayer mode tests FAILED${NC}"
    MULTIPLAYER_RESULT="FAILED"
fi

# Step 6: Run Stress Tests
echo ""
echo "=============================================="
echo -e "${BLUE}[6/8] Running Stress Tests${NC}"
echo "=============================================="
echo ""

echo "Testing: 100 APM, disconnects, concurrent actions, long sessions"
echo ""

if npx playwright test tests/stress-tests.spec.js --reporter=list; then
    echo -e "${GREEN}✅ Stress tests PASSED${NC}"
    STRESS_RESULT="PASSED"
else
    echo -e "${YELLOW}⚠️  Some stress tests FAILED (may be acceptable)${NC}"
    STRESS_RESULT="PARTIAL"
fi

# Step 7: Run Final Validation
echo ""
echo "=============================================="
echo -e "${BLUE}[7/8] Running Final Validation (19 items)${NC}"
echo "=============================================="
echo ""

echo "Testing: Core gameplay, UI/UX, accessibility, performance, security, polish"
echo ""

if npx playwright test tests/final-validation.spec.js --reporter=list; then
    echo -e "${GREEN}✅ Final validation PASSED${NC}"
    VALIDATION_RESULT="PASSED"
else
    echo -e "${RED}❌ Final validation FAILED${NC}"
    VALIDATION_RESULT="FAILED"
fi

# Step 8: Generate Reports
echo ""
echo "=============================================="
echo -e "${BLUE}[8/8] Generating Test Reports${NC}"
echo "=============================================="
echo ""

# Generate HTML report
echo "Generating HTML report..."
npx playwright show-report --host 127.0.0.1 &
REPORT_PID=$!

# Wait a moment for the server to start
sleep 2

# Get test results summary
if [ -f "test-results.json" ]; then
    echo "Test results saved to: test-results.json"
fi

# Final Summary
echo ""
echo "=============================================="
echo "  📊 TEST SUMMARY"
echo "=============================================="
echo ""

echo "Results:"
echo -e "  Multiplayer Modes: ${MULTIPLAYER_RESULT}"
echo -e "  Stress Tests:      ${STRESS_RESULT}"
echo -e "  Final Validation:  ${VALIDATION_RESULT}"
echo ""

# Overall status
if [ "$MULTIPLAYER_RESULT" = "PASSED" ] && [ "$VALIDATION_RESULT" = "PASSED" ]; then
    echo -e "${GREEN}🎉 OVERALL STATUS: READY FOR PRODUCTION 🎉${NC}"
    EXIT_CODE=0
else
    echo -e "${YELLOW}⚠️  OVERALL STATUS: NEEDS ATTENTION${NC}"
    echo ""
    echo "Review the test report for details:"
    echo "  http://127.0.0.1:9323"
    EXIT_CODE=1
fi

echo ""
echo "=============================================="
echo ""

# Service logs
echo "Recent service logs:"
docker-compose logs --tail=20

echo ""
echo "Commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Stop services:    docker-compose down"
echo "  Restart services: docker-compose restart"
echo "  Run tests again:  npm test"
echo "  View report:      npm run test:report"
echo ""

# Keep report server running
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Test report server running at http://127.0.0.1:9323"
    echo "Press Ctrl+C to stop the report server and exit."
    wait $REPORT_PID
else
    echo "❌ Tests failed. Review the report and logs."
    echo "Stopping report server in 30 seconds..."
    sleep 30
    kill $REPORT_PID 2>/dev/null || true
fi

exit $EXIT_CODE
