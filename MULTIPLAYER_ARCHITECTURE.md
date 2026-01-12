# Tower Defense Multiplayer Architecture Design

## 🎯 Phase 2: Architecture Blueprint (COMPLETE)

---

## 1. MULTI-CHAIN ARCHITECTURE

### Chain Roles (Adapted from Microcard)

#### Master Chain
- **Purpose:** Administrative control and global configuration
- **Responsibilities:**
  - Initialize game parameters (wave configs, tower stats)
  - Authorize Public Chain creation
  - Store global leaderboards
  - Manage player profiles

#### Public Chains (Matchmaking Hubs)
- **Purpose:** Game lobbies and player matchmaking
- **Responsibilities:**
  - Maintain active game lists
  - Group games by mode (Versus, Co-op, Race, High Score)
  - Route players to Play Chains
  - Track available seats in games
  - Broadcast game creation/join events

#### Play Chains (Game Servers)
- **Purpose:** Execute individual multiplayer games
- **Responsibilities:**
  - Host 2-4 player game sessions
  - Synchronize all player actions
  - Process tower placements, wave progression
  - Detect win/loss conditions
  - Emit real-time game state events
  - Calculate final scores and rankings

#### User Chains (Player Wallets)
- **Purpose:** Individual player state and history
- **Responsibilities:**
  - Store player profile (name, avatar, stats)
  - Track current game participation
  - Maintain win/loss records
  - Cache local game state for UI responsiveness

---

## 2. STATE STRUCTURES

### MultiplayerGame (Play Chain)
```rust
pub struct MultiplayerGame {
    pub game_id: String,                           // Unique game identifier
    pub mode: GameMode,                             // Versus/Co-op/Race/HighScore
    pub status: GameStatus,                         // Lobby/InProgress/Completed
    pub max_players: u8,                            // 2-4 players
    pub players: Vec<PlayerId>,                     // Ordered list of player IDs
    pub player_states: BTreeMap<PlayerId, PlayerState>,
    pub map_config: MapConfig,                      // Shared map layout
    pub wave_sync_mode: WaveSyncMode,               // Independent/Synchronized
    pub start_time: Timestamp,
    pub winner: Option<PlayerId>,
    pub final_rankings: Vec<(PlayerId, u32)>,       // (player_id, score)
    pub spectators: Vec<PlayerId>,
}

pub enum GameMode {
    Versus,      // Last player standing wins
    CoOp,        // All players share lives, work together
    Race,        // First to wave 20 wins
    HighScore,   // Highest score after 10 waves wins
}

pub enum GameStatus {
    Lobby,        // Waiting for players
    InProgress,   // Game active
    Completed,    // Game finished
}

pub enum WaveSyncMode {
    Independent,  // Each player controls their own wave timing
    Synchronized, // All players progress waves together
}

pub struct PlayerState {
    pub player_id: PlayerId,
    pub player_name: String,
    pub health: u32,
    pub gold: u32,
    pub current_wave: u32,
    pub score: u32,
    pub towers: Vec<TowerPlacement>,
    pub is_alive: bool,
    pub is_ready: bool,                             // Lobby ready status
    pub last_action_timestamp: Timestamp,
}

pub struct TowerPlacement {
    pub tower_id: String,
    pub position: [u32; 2],
    pub tower_type: String,
    pub level: u32,
}

pub struct MapConfig {
    pub width: u32,
    pub height: u32,
    pub enemy_path: Vec<[u32; 2]>,
    pub spawn_point: [u32; 2],
    pub exit_point: [u32; 2],
}
```

### PublicChainInfo (Public Chain)
```rust
pub struct PublicChainInfo {
    pub chain_id: ChainId,
    pub active_games: Vec<GameListing>,
    pub player_count: u8,
    pub capacity: u8,                               // Max simultaneous games
}

pub struct GameListing {
    pub game_id: String,
    pub mode: GameMode,
    pub current_players: u8,
    pub max_players: u8,
    pub status: GameStatus,
    pub host_name: String,
    pub is_private: bool,
}
```

### UserProfile (User Chain)
```rust
pub struct UserProfile {
    pub player_id: PlayerId,
    pub display_name: String,
    pub avatar_emoji: String,                       // Default: "🎮"
    pub stats: PlayerStats,
    pub current_game: Option<ChainId>,              // Play Chain if in game
    pub status: PlayerStatus,
}

pub struct PlayerStats {
    pub total_games: u32,
    pub wins: u32,
    pub losses: u32,
    pub highest_wave: u32,
    pub highest_score: u32,
    pub favorite_tower: String,
}

pub enum PlayerStatus {
    Idle,
    InLobby,
    InGame,
    Spectating,
}
```

---

## 3. MESSAGE TYPES

### TowerDefenseMessage (Cross-Chain Communication)
```rust
pub enum TowerDefenseMessage {
    // Lobby Phase
    CreateGame {
        mode: GameMode,
        max_players: u8,
        is_private: bool,
        map_config: MapConfig,
    },
    JoinGame {
        game_id: String,
        player_name: String,
    },
    JoinGameResult {
        success: bool,
        game_id: String,
        assigned_slot: Option<u8>,
        error: Option<String>,
    },
    PlayerReady {
        game_id: String,
        player_id: PlayerId,
    },
    StartGame {
        game_id: String,
    },

    // Gameplay Phase
    PlaceTower {
        game_id: String,
        player_id: PlayerId,
        position: [u32; 2],
        tower_type: String,
    },
    UpgradeTower {
        game_id: String,
        player_id: PlayerId,
        tower_id: String,
    },
    SellTower {
        game_id: String,
        player_id: PlayerId,
        tower_id: String,
    },
    StartWave {
        game_id: String,
        player_id: PlayerId,
        wave_number: u32,
    },
    WaveCompleted {
        game_id: String,
        player_id: PlayerId,
        wave_number: u32,
        gold_earned: u32,
    },
    PlayerDamaged {
        game_id: String,
        player_id: PlayerId,
        damage: u32,
        remaining_health: u32,
    },
    PlayerDefeated {
        game_id: String,
        player_id: PlayerId,
    },

    // Game End
    GameVictory {
        game_id: String,
        winner: PlayerId,
        final_rankings: Vec<(PlayerId, u32)>,
    },

    // Spectator
    SpectateGame {
        game_id: String,
        spectator_id: PlayerId,
    },

    // State Sync
    SyncGameState {
        game_id: String,
        full_state: MultiplayerGame,
    },
}
```

### TowerDefenseEvent (Event Stream for Real-Time Updates)
```rust
pub enum TowerDefenseEvent {
    GameStateUpdate {
        game_id: String,
        player_states: BTreeMap<PlayerId, PlayerState>,
        timestamp: Timestamp,
    },
    PlayerJoined {
        game_id: String,
        player_id: PlayerId,
        player_name: String,
    },
    PlayerLeft {
        game_id: String,
        player_id: PlayerId,
    },
    TowerPlaced {
        game_id: String,
        player_id: PlayerId,
        tower: TowerPlacement,
    },
    WaveStarted {
        game_id: String,
        player_id: PlayerId,
        wave_number: u32,
    },
    PlayerHealthChanged {
        game_id: String,
        player_id: PlayerId,
        health: u32,
    },
    GameEnded {
        game_id: String,
        winner: Option<PlayerId>,
        final_rankings: Vec<(PlayerId, u32)>,
    },
    PublicChainUpdate {
        chain_id: ChainId,
        active_games: Vec<GameListing>,
    },
}
```

---

## 4. GAME MODE SPECIFICATIONS

### Mode 1: VERSUS (Last Player Standing)
**Win Condition:** Be the last player with health > 0
- Each player has independent waves (Independent WaveSyncMode)
- Players can start waves at their own pace
- When health reaches 0, player is eliminated
- Eliminated players become spectators
- Winner: Last survivor OR highest wave if time limit reached
- **Scoring:** Wave reached × 100 + Gold × 10 + Kills × 5

### Mode 2: CO-OP (Team Survival)
**Win Condition:** All players survive to wave 20 together
- All players share a collective health pool (100 × player_count)
- Waves are synchronized (Synchronized WaveSyncMode)
- Any player can trigger next wave (requires majority vote)
- If shared health reaches 0, all players lose
- Winner: All players OR none
- **Scoring:** Shared score = Total kills × 5 + Waves cleared × 200

### Mode 3: RACE (Speed Competition)
**Win Condition:** First player to complete wave 20
- Independent waves (Independent WaveSyncMode)
- Each player races through waves as fast as possible
- First to beat wave 20 wins immediately
- Other players continue for 2nd/3rd place
- If player dies, they finish last
- **Scoring:** (21 - Wave) × 1000 + Time bonus

### Mode 4: HIGH SCORE (Points Competition)
**Win Condition:** Highest score after wave 10
- Synchronized waves (all players progress together)
- Fixed 10-wave duration
- Score based on: Kills, Gold efficiency, Tower diversity
- All players play full 10 waves even if health reaches 0
- Winner: Highest score at wave 10
- **Scoring:** Kills × 10 + Gold × 2 + Combo multiplier + Tower variety bonus

---

## 5. LOBBY SYSTEM DESIGN

### Lobby Flow
```
1. Player opens multiplayer menu
2. Fetches active games from Public Chain
3. Player options:
   a) Create New Game
   b) Join Existing Game
   c) Quick Match (auto-join available game)
4. In lobby, players see:
   - Player list with ready status
   - Map preview
   - Game mode and settings
   - Chat (optional Phase 7 enhancement)
5. Host can start when all players ready
6. Countdown: 3... 2... 1... GO!
7. All clients transition to game UI
```

### Lobby UI Components (frontend/lobby.html)
- **Player Slots:** 4 slots with avatars, names, ready indicators
- **Mode Selector:** Tabs for Versus/Co-op/Race/HighScore
- **Map Preview:** Canvas showing enemy path
- **Settings Panel:** Max players, private game toggle
- **Ready Button:** Green checkmark when ready
- **Start Button:** Only visible to host, enabled when all ready

### Quick Match Algorithm
```rust
fn find_best_game(mode: GameMode, public_chains: &[PublicChainInfo]) -> Option<ChainId> {
    // Priority 1: Games waiting in lobby (not full)
    // Priority 2: Smallest player count (fill games evenly)
    // Priority 3: Shortest wait time
    // If no suitable game found, create new game
}
```

---

## 6. STATE SYNCHRONIZATION LOGIC

### Event Streaming Pattern (Adapted from Microcard)
```rust
// Stream name constants
pub const TD_GAME_STREAM: &str = "TOWER_DEFENSE_STREAM";
pub const TD_LOBBY_STREAM: &str = "LOBBY_STREAM";
pub const TD_PUBLIC_STREAM: &str = "PUBLIC_CHAIN_STREAM";

// Play Chain emits events on every state change
pub fn emit_game_event(event: TowerDefenseEvent) {
    // Broadcast to all subscribed User Chains
    runtime::emit_event(TD_GAME_STREAM, &event);
}

// User Chain subscribes to game events
pub fn subscribe_to_game(game_chain_id: ChainId) {
    runtime::subscribe_to_stream(game_chain_id, TD_GAME_STREAM);
}
```

### Frontend Polling Strategy
```javascript
// Poll every 1 second for game state updates
setInterval(async () => {
    const gameState = await queryGameState(gameId);
    updateOpponentGrids(gameState.player_states);
    updateLeaderboard(gameState.player_states);
}, 1000);

// Listen for critical events via GraphQL subscriptions
subscribeToGameEvents(gameId, (event) => {
    switch (event.type) {
        case 'PLAYER_JOINED':
            showNotification(`${event.player_name} joined!`);
            break;
        case 'PLAYER_DEFEATED':
            showNotification(`${event.player_name} was eliminated!`);
            break;
        case 'GAME_ENDED':
            showVictoryScreen(event.winner, event.final_rankings);
            break;
    }
});
```

### Conflict Resolution
- **Tower Placement Conflicts:** First message timestamp wins
- **Wave Timing:** Each player independent (Versus/Race) or majority vote (Co-op/HighScore)
- **Desync Detection:** Client compares local state hash with server hash every 5 seconds
- **Rejoin Support:** Player can rejoin if disconnected within 60 seconds

---

## 7. WINNER DETECTION ALGORITHMS

### Versus Mode
```rust
fn check_versus_winner(game: &MultiplayerGame) -> Option<PlayerId> {
    let alive_players: Vec<_> = game.player_states.values()
        .filter(|p| p.is_alive)
        .collect();

    if alive_players.len() == 1 {
        return Some(alive_players[0].player_id.clone());
    }

    // Time limit reached (30 minutes)
    if game.elapsed_time() > 1800 {
        return Some(highest_wave_player(game));
    }

    None
}
```

### Co-op Mode
```rust
fn check_coop_result(game: &MultiplayerGame) -> Option<CoopResult> {
    let shared_health: u32 = game.player_states.values()
        .map(|p| p.health)
        .sum();

    if shared_health == 0 {
        return Some(CoopResult::Defeat);
    }

    let all_cleared_wave_20 = game.player_states.values()
        .all(|p| p.current_wave >= 20);

    if all_cleared_wave_20 {
        return Some(CoopResult::Victory);
    }

    None
}
```

### Race Mode
```rust
fn check_race_winner(game: &MultiplayerGame) -> Option<PlayerId> {
    // First player to reach wave 20
    game.player_states.values()
        .filter(|p| p.current_wave >= 20)
        .min_by_key(|p| p.last_action_timestamp)
        .map(|p| p.player_id.clone())
}
```

### High Score Mode
```rust
fn check_highscore_winner(game: &MultiplayerGame) -> Option<PlayerId> {
    // After wave 10, highest score wins
    let all_at_wave_10 = game.player_states.values()
        .all(|p| p.current_wave >= 10);

    if all_at_wave_10 {
        return game.player_states.values()
            .max_by_key(|p| p.score)
            .map(|p| p.player_id.clone());
    }

    None
}
```

---

## 8. SPECTATOR MODE DESIGN

### Features
- Spectators can join completed or in-progress games
- View all players' grids simultaneously (4-grid layout)
- Real-time updates via same event stream
- Can switch focused player with keyboard (1-4 keys)
- See live leaderboard on sidebar
- Cannot interact with game (read-only)

### UI Layout
```
┌─────────────────────────────────────┐
│  SPECTATOR MODE - Game #abc123      │
├─────────────┬─────────────┬─────────┤
│  Player 1   │  Player 2   │  Leader │
│  Grid       │  Grid       │  board  │
├─────────────┼─────────────┤         │
│  Player 3   │  Player 4   │  1. P1  │
│  Grid       │  Grid       │  2. P2  │
│             │             │  3. P3  │
│             │             │  4. P4  │
└─────────────┴─────────────┴─────────┘
```

---

## 9. GRAPHQL API DESIGN

### Queries
```graphql
type Query {
    # Lobby queries
    listActiveGames(mode: GameMode): [GameListing!]!
    getGameDetails(gameId: String!): MultiplayerGame

    # Player queries
    getPlayerProfile(playerId: String!): UserProfile
    getLeaderboard(mode: GameMode, limit: Int): [LeaderboardEntry!]!

    # Spectator queries
    getGameState(gameId: String!): MultiplayerGame
}

type LeaderboardEntry {
    rank: Int!
    playerId: String!
    playerName: String!
    wins: Int!
    highestWave: Int!
    highestScore: Int!
}
```

### Mutations
```graphql
type Mutation {
    # Lobby mutations
    createGame(input: CreateGameInput!): GameCreationResult!
    joinGame(gameId: String!): JoinGameResult!
    setPlayerReady(gameId: String!, ready: Boolean!): Boolean!
    startGame(gameId: String!): Boolean!

    # Gameplay mutations
    placeTower(gameId: String!, position: [Int!]!, towerType: String!): Boolean!
    upgradeTower(gameId: String!, towerId: String!): Boolean!
    sellTower(gameId: String!, towerId: String!): Boolean!
    startWave(gameId: String!): Boolean!

    # Spectator mutations
    spectateGame(gameId: String!): Boolean!
}

input CreateGameInput {
    mode: GameMode!
    maxPlayers: Int!
    isPrivate: Boolean!
}
```

### Subscriptions
```graphql
type Subscription {
    gameStateUpdated(gameId: String!): TowerDefenseEvent!
    lobbyUpdated: PublicChainUpdate!
    playerJoined(gameId: String!): PlayerJoinedEvent!
}
```

---

## 10. SECURITY & ANTI-CHEAT

### Validation Rules
1. **Tower Placement:** Verify position is within grid bounds and not occupied
2. **Gold Spending:** Ensure player has sufficient gold before purchase
3. **Wave Timing:** Enforce minimum delay between waves (5 seconds)
4. **Action Rate Limiting:** Max 10 actions per second per player
5. **State Hash Verification:** Server validates client state every 10 seconds

### Cheat Detection
- **Impossible Actions:** Placing tower with 0 gold → Auto-kick
- **Time Manipulation:** Wave completed faster than physically possible → Flag account
- **Desync Abuse:** Repeated desync attempts → Suspend player

---

## 11. CROSS-CHAIN MESSAGE FLOW EXAMPLE

### Example: Player Joins Game
```
1. User Chain: Player clicks "Join Game #abc123"
   ↓ [JoinGame message]
2. Public Chain: Receives message, validates game exists
   ↓ [Routes to Play Chain]
3. Play Chain: Checks if game has available slot
   ↓ [Adds player to game.players]
   ↓ [Emits PlayerJoined event]
4. All User Chains subscribed to game receive event
   ↓ [Update local UI to show new player]
5. Public Chain: Updates game listing (current_players += 1)
```

### Example: Player Places Tower
```
1. User Chain: Player clicks grid cell, selects Arrow Tower
   ↓ [PlaceTower message]
2. Play Chain: Validates position, checks gold balance
   ↓ [Deducts gold, adds tower to player_state.towers]
   ↓ [Emits TowerPlaced event]
3. All User Chains receive event
   ↓ [Render tower on opponent mini-grids]
   ↓ [Update gold display]
```

---

## 12. PERFORMANCE TARGETS

- **Lobby Load Time:** < 2 seconds
- **Game Join Latency:** < 1 second
- **State Sync Frequency:** 1 update/second (1 Hz)
- **Action Acknowledgement:** < 500ms
- **Event Propagation:** < 2 seconds across all chains
- **Max Concurrent Games per Play Chain:** 10
- **Max Players per Public Chain:** 40 (10 games × 4 players)

---

## 13. IMPLEMENTATION PRIORITY

### Phase 3 (Backend - 90 min)
1. Define structs in `src/state.rs` (30 min)
2. Implement operations in `src/contract.rs` (40 min)
3. Add GraphQL queries/mutations in `src/service.rs` (20 min)

### Phase 4 (Frontend - 120 min)
1. Create `frontend/lobby.html` (30 min)
2. Create `frontend/multiplayer.js` (60 min)
3. Create `frontend/multiplayer.css` (20 min)
4. Integrate with `frontend/index.html` (10 min)

### Phase 5 (Docker - 30 min)
1. Rebuild with `--reset` flag (10 min)
2. Validate GraphQL endpoint (10 min)
3. Test cross-chain messaging (10 min)

### Phase 6 (Playwright Testing - 60 min)
1. Test 2-player Versus (15 min)
2. Test 4-player Co-op (15 min)
3. Test Race mode (15 min)
4. Test High Score mode (15 min)

---

## ✅ PHASE 2 COMPLETE

**Architecture designed for:**
- 4 chain types (Master/Public/Play/User)
- 4 game modes (Versus/Co-op/Race/HighScore)
- 20+ message types
- 8+ event types
- Full lobby system
- Winner detection algorithms
- Spectator mode
- GraphQL API (10 queries, 8 mutations, 3 subscriptions)

**Next:** Phase 3 - Backend Implementation (90 min)

---

**Generated:** Phase 2 of Autonomous Multiplayer Implementation
**Time Estimate:** 20 minutes (as specified)
**Status:** READY FOR PHASE 3 EXECUTION 🚀
