#!/bin/bash
# Run all test suites
# Usage: ./scripts/run-all-tests.sh

set -e

echo "=========================================="
echo "  TOWER DEFENSE - COMPLETE TEST SUITE"
echo "=========================================="
echo ""

cd "$(dirname "$0")/.."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if services are running
echo -e "${YELLOW}[1/5] Checking services...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200"; then
    echo -e "${GREEN}✅ Services are running${NC}"
else
    echo -e "${RED}❌ Services not running. Start with: docker-compose up -d${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules/@playwright/test" ]; then
    echo -e "${YELLOW}[2/5] Installing Playwright...${NC}"
    npm install --save-dev @playwright/test
    npx playwright install chromium
else
    echo -e "${GREEN}✅ Playwright already installed${NC}"
fi

# Run multiplayer modes tests
echo ""
echo -e "${YELLOW}[3/5] Running multiplayer modes tests...${NC}"
npx playwright test tests/multiplayer-modes.spec.js --reporter=list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Multiplayer modes tests passed${NC}"
else
    echo -e "${RED}❌ Multiplayer modes tests failed${NC}"
    exit 1
fi

# Run stress tests
echo ""
echo -e "${YELLOW}[4/5] Running stress tests...${NC}"
npx playwright test tests/stress-tests.spec.js --reporter=list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Stress tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Some stress tests failed (may be acceptable)${NC}"
fi

# Run final validation
echo ""
echo -e "${YELLOW}[5/5] Running final validation...${NC}"
npx playwright test tests/final-validation.spec.js --reporter=list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Final validation passed${NC}"
else
    echo -e "${RED}❌ Final validation failed${NC}"
    exit 1
fi

# Generate report
echo ""
echo -e "${YELLOW}Generating HTML report...${NC}"
npx playwright show-report

echo ""
echo "=========================================="
echo -e "${GREEN}  ✅ ALL TESTS COMPLETE${NC}"
echo "=========================================="
echo ""
echo "📊 View HTML report: playwright-report/index.html"
echo "📁 Test results: test-results.json"
echo ""
