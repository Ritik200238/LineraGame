# 🏰 Tower Defense on Linera - Multiplayer Edition

[![Linera](https://img.shields.io/badge/Linera-Testnet%20Conway-blue)](https://linera.io)
[![Rust](https://img.shields.io/badge/Rust-1.86-orange)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-60%2B-success)](tests/)

A **fully functional multiplayer tower defense game** built on the [Linera](https://linera.io) blockchain platform, featuring:
- ⚡ **Sub-second finality** for real-time gameplay
- 🔗 **Multi-chain architecture** for horizontal scaling
- 📡 **Cross-chain messaging** for multiplayer synchronization
- 🎮 **Professional web frontend** with GraphQL integration
- 🏆 **4 competitive game modes** (Versus, Co-op, Race, High Score)
- 🎨 **Modern UI/UX** with animations and celebrations
- ♿ **WCAG AAA accessibility** with full keyboard navigation
- 📱 **Mobile responsive** design (375px-768px)
- 🎯 **60 FPS performance** with sub-200ms latency

---

## 🎬 Demo Video

> 📹 **[Watch Demo on YouTube](https://youtube.com/watch?v=YOUR_VIDEO_ID)** (Coming soon)

---

## 📸 Screenshots

<table>
<tr>
<td><img src="screenshots/gameplay.png" alt="Gameplay" width="300"/></td>
<td><img src="screenshots/tower-selection.png" alt="Tower Selection" width="300"/></td>
</tr>
<tr>
<td><em>Tower Defense Gameplay</em></td>
<td><em>Tower Selection Panel</em></td>
</tr>
</table>

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone and run with one command
git clone https://github.com/YOUR_USERNAME/tower-defense.git
cd tower-defense
docker compose up -d --build

# Watch logs (wait for "TOWER DEFENSE IS READY!")
docker compose logs -f tower-defense

# Access the game
open http://localhost:5173
```

### Option 2: Local Development

```bash
# Prerequisites: Rust, Linera SDK 0.15+, Node.js

# Clone repository
git clone https://github.com/YOUR_USERNAME/tower-defense.git
cd tower-defense

# Run locally
chmod +x run.bash
./run.bash

# Or deploy to Conway testnet
./run.bash --testnet
```

---

## 🔗 Conway Testnet Deployment

> **Application ID:** `65b1d4177fc4f393a20bd2eb7644578f2d2130bc63b20a190d93c219dfd8b4b4`
>
> **Chain ID:** `0bf6d759674940c211cfc24099a211ba1765c9e7aec271b5bae76ec2ff71a015`

---

## 🎮 Game Modes

### ⚔️ Versus Mode
**Objective:** Last player standing wins
- **Wave Sync:** Independent (each player controls own waves)
- **Win Condition:** Eliminate all other players
- **Players:** 2-4
- **Strategy:** Balance offense (progressing waves) with defense (surviving)

### 🤝 Co-op Mode
**Objective:** Team survival
- **Wave Sync:** Synchronized (all players progress together)
- **Win Condition:** Reach target wave (default: wave 20)
- **Players:** 2-4
- **Strategy:** Coordinate tower placement and resource management

### 🏁 Race Mode
**Objective:** First to wave 20 wins
- **Wave Sync:** Independent (each player controls own waves)
- **Win Condition:** First player to complete wave 20
- **Players:** 2-4
- **Strategy:** Optimize tower placement for fastest progression

### 🏆 High Score Mode
**Objective:** Highest score after fixed waves
- **Wave Sync:** Synchronized (all players play 10 waves)
- **Win Condition:** Highest score when all complete wave 10
- **Players:** 2-4
- **Strategy:** Maximize kills, minimize damage, optimize gold efficiency

---

## 🧪 Testing

Comprehensive test suite with 60+ test cases covering all game modes and features.

### Run All Tests
```bash
# Install Playwright
npm install

# Run complete test suite
npm test

# Or use the script
./scripts/run-all-tests.sh
```

### Run Specific Test Suites
```bash
# Multiplayer modes (Versus, Co-op, Race, High Score)
npm run test:multiplayer

# Stress testing (100 APM, disconnects, 30-min sessions)
npm run test:stress

# Final validation (19-item checklist)
npm run test:validation

# View test report
npm run test:report
```

### Test Categories
- **Multiplayer Modes:** 12+ tests for 4 game modes
- **Stress Testing:** Rapid actions, disconnects, concurrent players
- **Final Validation:** 19-item WCAG/performance/security checklist

### Documentation
- [Phase 5-6: Testing Guide](PHASE_5_6_TESTING_GUIDE.md)
- [Phase 8: Stress Testing](PHASE_8_STRESS_TESTING.md)
- [Phase 9: Final Validation](PHASE_9_FINAL_VALIDATION.md)

---

## 🎮 How to Play

1. **Connect Wallet** - Configure your Linera service URL in Settings
2. **Place Towers** - Select a tower type and click on the grid
3. **Start Wave** - Click "Start Wave" to spawn enemies
4. **Defend Base** - Towers automatically attack enemies in range
5. **Upgrade** - Spend gold to upgrade towers for more damage
6. **Survive** - Complete 100 waves to achieve victory!

### 🗼 Tower Types

| Tower | Icon | Cost | Damage | Range | Special |
|-------|------|------|--------|-------|---------|
| Arrow | 🏹 | 100 | 10 | 3 | Fast fire rate |
| Cannon | 💣 | 250 | 50 | 4 | High damage |
| Magic | ✨ | 200 | 15 | 2 | Bonus vs tanks |
| Ice | ❄️ | 150 | 5 | 3 | Slows enemies 30% |
| Lightning | ⚡ | 300 | 30 | 3 | Chain damage |

### 👾 Enemy Types

| Enemy | Icon | Health | Speed | Reward |
|-------|------|--------|-------|--------|
| Scout | 👾 | Low | Normal | 10 |
| Soldier | 🛡️ | Medium | Slow | 25 |
| Runner | 🏃 | Low | Fast | 15 |
| Tank | 🦏 | High | Slow | 50 |
| Boss | 👹 | Very High | Medium | 200 |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Master Chain                            │
│   • Leaderboard tracking    • Season management                 │
│   • Public chain registry   • Score aggregation                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    Cross-chain Messages
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│                        Public Chains                            │
│   • Game matchmaking         • Room discovery                   │
│   • Player routing           • Load balancing                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                         Event Streams
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│                         Game Chains                             │
│   • Active gameplay          • Tower placement                  │
│   • Wave spawning            • Real-time combat                 │
│   • Gold distribution        • Victory/defeat detection         │
└─────────────────────────────────────────────────────────────────┘
```

### Why Linera?

- **Sub-second finality**: Players see actions reflected in <1 second
- **Microchains**: Each game runs on its own chain, enabling horizontal scaling
- **Cross-chain messaging**: Multiplayer sync without central server
- **Event streaming**: Real-time updates pushed to all players

---

## 📂 Project Structure

```
tower-defense/
├── abi/                    # Shared types and game logic
│   └── src/
│       ├── game.rs         # Grid, game config
│       ├── tower.rs        # Tower types, stats, upgrades
│       ├── enemy.rs        # Enemy types, movement
│       ├── wave.rs         # Wave generation
│       ├── combat.rs       # Targeting, damage calculation
│       ├── pathfinding.rs  # A* pathfinding
│       └── economy.rs      # Gold, costs, rewards
├── src/                    # Linera application
│   ├── lib.rs              # Operations, Messages, Events
│   ├── contract.rs         # Contract logic (700+ lines)
│   ├── service.rs          # GraphQL service (500+ lines)
│   ├── state.rs            # Chain state definitions
│   └── guards.rs           # Security validations
├── frontend/               # Web frontend
│   ├── index.html          # Game UI
│   ├── styles.css          # Dark theme styling
│   └── game.js             # GraphQL client & game logic
├── tests/                  # Integration tests
│   └── game_logic_test.rs  # 10+ test cases
├── Dockerfile              # Docker build
├── compose.yaml            # Docker Compose
├── run.bash                # Deployment script
├── Makefile                # Build commands
└── README.md               # This file
```

---

## 🔧 GraphQL API

### Queries

```graphql
query {
  # Game state
  sharedGold
  baseHealth
  waveNumber
  waveActive
  gameStatus

  # Towers
  towers { id position towerType level damage range }
  towerCount

  # Enemies
  enemies { id enemyType position health maxHealth }
  enemyCount

  # Grid
  grid { width height path spawnPoint basePoint }
}
```

### Mutations

```graphql
mutation {
  placeTower(positionX: 5, positionY: 5, towerType: "Arrow") {
    operationType
    payload
  }
  
  startWave { operationType payload }
  
  upgradeTower(towerId: "1") { operationType payload }
  
  sellTower(towerId: "1") { operationType payload }
}
```

---

## 🔒 Security Features

- ✅ **Tower ownership tracking** - Only owners can upgrade/sell
- ✅ **Wave cooldown** - 5-second minimum between waves
- ✅ **Tower limits** - Max 20 towers per player
- ✅ **Tick timeout** - Auto-defeat after 1000 seconds
- ✅ **Input validation** - All operations validated
- ✅ **Admin guards** - Master chain operations protected

---

## 🧪 Testing

```bash
# Run all tests
make test

# Or manually
cargo test
cd abi && cargo test

# Lint
make lint

# Format check
make fmt
```

---

## 📜 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Linera](https://linera.io) - Blockchain platform
- Built for [WaveHack](https://wavehack.io) hackathon

---

**Made with ❤️ for the Linera ecosystem**
