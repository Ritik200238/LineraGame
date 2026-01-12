@echo off
REM Complete Multiplayer Testing Script for Windows
REM Tests all 4 game modes, stress testing, and validation on local Linera
REM Usage: test-multiplayer-complete.bat

setlocal enabledelayedexpansion

echo ==============================================
echo   TOWER DEFENSE MULTIPLAYER TEST SUITE
echo ==============================================
echo.

cd /d "%~dp0"

REM Step 1: Check Prerequisites
echo [1/8] Checking prerequisites...

where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker not found. Please install Docker Desktop.
    exit /b 1
)
echo OK: Docker found

where docker-compose >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker Compose not found. Please install Docker Compose.
    exit /b 1
)
echo OK: Docker Compose found

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found. Please install Node.js 18+
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo OK: Node.js found (!NODE_VERSION!)

if not exist "package.json" (
    echo ERROR: Not in tower-defense directory
    exit /b 1
)
echo OK: In correct directory
echo.

REM Step 2: Install Dependencies
echo [2/8] Installing test dependencies...

if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
) else (
    echo npm packages already installed
)

if not exist "node_modules\@playwright\test" (
    echo Installing Playwright...
    call npm install --save-dev @playwright/test
)

echo Installing Playwright browsers...
call npx playwright install chromium

echo OK: Dependencies installed
echo.

REM Step 3: Clean Docker Environment
echo [3/8] Cleaning Docker environment...

docker-compose down >nul 2>&1

echo OK: Environment cleaned
echo.

REM Step 4: Build and Start Services
echo [4/8] Building and starting Linera services...

echo Building Rust contracts...
cargo build --release --target wasm32-unknown-unknown

echo Starting Docker Compose services...
docker-compose up -d --build

echo Waiting for services to be ready...
timeout /t 20 /nobreak >nul

REM Check if services are responding
curl -s -o nul -w "%%{http_code}" http://localhost:8080 | findstr "200 404" >nul
if %ERRORLEVEL% EQU 0 (
    echo OK: Services are responding
) else (
    echo WARNING: Services may not be fully ready
)

echo OK: Services started
echo.

docker-compose ps
echo.

REM Step 5: Run Multiplayer Mode Tests
echo ==============================================
echo [5/8] Running Multiplayer Mode Tests
echo ==============================================
echo.

call npx playwright test tests/multiplayer-modes.spec.js --reporter=list
if %ERRORLEVEL% EQU 0 (
    echo OK: Multiplayer mode tests PASSED
    set MULTIPLAYER_RESULT=PASSED
) else (
    echo FAIL: Multiplayer mode tests FAILED
    set MULTIPLAYER_RESULT=FAILED
)
echo.

REM Step 6: Run Stress Tests
echo ==============================================
echo [6/8] Running Stress Tests
echo ==============================================
echo.

call npx playwright test tests/stress-tests.spec.js --reporter=list
if %ERRORLEVEL% EQU 0 (
    echo OK: Stress tests PASSED
    set STRESS_RESULT=PASSED
) else (
    echo WARNING: Some stress tests FAILED
    set STRESS_RESULT=PARTIAL
)
echo.

REM Step 7: Run Final Validation
echo ==============================================
echo [7/8] Running Final Validation (19 items)
echo ==============================================
echo.

call npx playwright test tests/final-validation.spec.js --reporter=list
if %ERRORLEVEL% EQU 0 (
    echo OK: Final validation PASSED
    set VALIDATION_RESULT=PASSED
) else (
    echo FAIL: Final validation FAILED
    set VALIDATION_RESULT=FAILED
)
echo.

REM Step 8: Generate Reports
echo ==============================================
echo [8/8] Generating Test Reports
echo ==============================================
echo.

echo Generating HTML report...
start /B npx playwright show-report

echo.
echo ==============================================
echo   TEST SUMMARY
echo ==============================================
echo.

echo Results:
echo   Multiplayer Modes: !MULTIPLAYER_RESULT!
echo   Stress Tests:      !STRESS_RESULT!
echo   Final Validation:  !VALIDATION_RESULT!
echo.

if "!MULTIPLAYER_RESULT!"=="PASSED" if "!VALIDATION_RESULT!"=="PASSED" (
    echo OVERALL STATUS: READY FOR PRODUCTION
) else (
    echo OVERALL STATUS: NEEDS ATTENTION
)

echo.
echo ==============================================
echo.

echo Recent service logs:
docker-compose logs --tail=20

echo.
echo Commands:
echo   View logs:        docker-compose logs -f
echo   Stop services:    docker-compose down
echo   Restart services: docker-compose restart
echo   Run tests again:  npm test
echo   View report:      npm run test:report
echo.

echo Test report opening in browser...
echo Press any key to stop services and exit.
pause >nul

docker-compose down

endlocal
