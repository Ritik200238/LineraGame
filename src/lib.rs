pub mod contract;
pub mod guards;
pub mod service;
pub mod state;

use async_graphql::{Request, Response};
use linera_sdk::linera_base_types::{AccountOwner, ChainId, ContractAbi, ServiceAbi};
use serde::{Deserialize, Serialize};
use tower_defense_abi::*;

pub use contract::TowerDefenseContract;
pub use service::TowerDefenseService;
pub use state::*;

/// Application parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TowerDefenseParameters {
    pub master_chain: ChainId,
    pub public_chains: Vec<ChainId>,
}

/// Operations that can be executed on this application
/// Operations are executed via contract calls
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Operation {
    // ===== User Operations =====
    /// Find a game to join (user chain -> public chain)
    FindGame {},

    /// Create a new multiplayer game
    CreateGame {
        mode: GameMode,
        max_players: u8,
        is_private: bool,
    },

    /// Join an existing game
    JoinGame { game_id: String },

    /// Set player ready status in lobby
    SetPlayerReady { ready: bool },

    /// Leave current game
    LeaveGame {},

    /// Place a tower at a position
    PlaceTower {
        position_x: u8,
        position_y: u8,
        tower_type: TowerType,
    },

    /// Upgrade an existing tower
    UpgradeTower { tower_id: u64 },

    /// Sell a tower for gold
    SellTower { tower_id: u64 },

    /// Start the next wave
    StartWave {},

    // ===== Master Operations =====
    /// Add a new public chain to the registry (master only)
    AddPublicChain {
        public_chain_id: ChainId,
        region: String,
    },
}

/// Responses from operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationResponse {
    Ok,
    FindGameStarted,
    GameCreated { game_id: String, game_chain: ChainId },
    JoinedGame { game_id: String },
    LeftGame,
    PlayerReadyUpdated { ready: bool },
    TowerPlaced { tower_id: u64 },
    TowerUpgraded { tower_id: u64, new_level: u8 },
    TowerSold { tower_id: u64, refund: u64 },
    WaveStarted { wave_number: u32 },
}

/// Cross-chain messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    // ===== Lobby Messages =====
    /// Request to find a game (user chain -> public chain)
    FindGameRequest { user_chain: ChainId },

    /// Response with game chain assignment (public chain -> user chain)
    FindGameResult { game_chain: Option<ChainId> },

    /// Create game request (user chain -> game chain)
    CreateGameRequest {
        mode: GameMode,
        max_players: u8,
        is_private: bool,
        player_name: String,
        user_chain: ChainId,
    },

    /// Create game response (game chain -> user chain)
    CreateGameResult { game_id: String, success: bool },

    /// Join game request (user chain -> game chain)
    JoinGameRequest {
        game_id: String,
        player_name: String,
        user_chain: ChainId,
    },

    /// Join game response (game chain -> user chain)
    JoinGameResult {
        game_id: String,
        success: bool,
        error: Option<String>,
    },

    /// Player ready status update (user chain -> game chain)
    PlayerReadyUpdate {
        game_id: String,
        player_id: AccountOwner,
        ready: bool,
    },

    /// Start game (host user chain -> game chain)
    StartGameRequest { game_id: String },

    /// Leave game (user chain -> game chain)
    LeaveGameRequest {
        game_id: String,
        player_id: AccountOwner,
    },

    // ===== Gameplay Messages =====
    /// Tower placed notification (game chain -> all player chains)
    TowerPlacedNotification {
        game_id: String,
        player_id: AccountOwner,
        tower_id: u64,
        position: (u8, u8),
        tower_type: TowerType,
    },

    /// Wave started notification (game chain -> all player chains)
    WaveStartedNotification {
        game_id: String,
        player_id: AccountOwner,
        wave_number: u32,
    },

    /// Player damaged notification (game chain -> all player chains)
    PlayerDamagedNotification {
        game_id: String,
        player_id: AccountOwner,
        damage: u32,
        remaining_health: u32,
    },

    /// Player defeated notification (game chain -> all player chains)
    PlayerDefeatedNotification {
        game_id: String,
        player_id: AccountOwner,
    },

    /// Game tick for processing game logic
    GameTick { delta_time_micros: u64 },

    // ===== Game End Messages =====
    /// Game victory notification (game chain -> all player chains)
    GameVictoryNotification {
        game_id: String,
        winner: Option<AccountOwner>,
        final_rankings: Vec<(AccountOwner, u32)>,
    },

    /// Report final scores to master chain (game chain -> master chain)
    ReportScore { scores: Vec<PlayerScore> },

    // ===== State Sync Messages =====
    /// Full game state sync (game chain -> player chain)
    SyncGameState { game_id: String },
}

/// Events emitted by the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TowerDefenseEvent {
    // ===== Lobby Events =====
    GameCreated {
        game_id: String,
        host: AccountOwner,
        mode: GameMode,
    },

    PlayerJoined {
        game_id: String,
        player_id: AccountOwner,
        player_name: String,
    },

    PlayerLeft {
        game_id: String,
        player_id: AccountOwner,
    },

    PlayerReadyChanged {
        game_id: String,
        player_id: AccountOwner,
        ready: bool,
    },

    GameStarted {
        game_id: String,
        player_count: u8,
    },

    // ===== Gameplay Events =====
    TowerPlaced {
        tower_id: u64,
        tower: Tower,
        player_id: Option<AccountOwner>,
    },

    TowerUpgraded {
        tower_id: u64,
        new_level: u8,
    },

    TowerSold {
        tower_id: u64,
        refund: u64,
    },

    EnemyKilled {
        enemy_id: u64,
        killed_by: AccountOwner,
        gold_reward: u64,
    },

    WaveStarted {
        wave_number: u32,
        enemy_count: usize,
        player_id: Option<AccountOwner>,
    },

    WaveCompleted {
        wave_number: u32,
        bonus_gold: u64,
    },

    PlayerHealthChanged {
        game_id: String,
        player_id: AccountOwner,
        health: u32,
    },

    PlayerDefeated {
        game_id: String,
        player_id: AccountOwner,
    },

    // ===== Game End Events =====
    GameOver {
        victory: bool,
        final_wave: u32,
        winner: Option<AccountOwner>,
    },

    GameEnded {
        game_id: String,
        winner: Option<AccountOwner>,
        final_rankings: Vec<(AccountOwner, u32)>,
    },
}

/// ABI definition
pub struct TowerDefenseAbi;

impl ContractAbi for TowerDefenseAbi {
    type Operation = Operation;
    type Response = OperationResponse;
}

impl ServiceAbi for TowerDefenseAbi {
    type Query = Request;
    type QueryResponse = Response;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operation_serialization() {
        let op = Operation::PlaceTower {
            position: (5, 5),
            tower_type: TowerType::Arrow,
        };

        let serialized = serde_json::to_string(&op).unwrap();
        let deserialized: Operation = serde_json::from_str(&serialized).unwrap();

        match deserialized {
            Operation::PlaceTower {
                position,
                tower_type,
            } => {
                assert_eq!(position, (5, 5));
                assert_eq!(tower_type, TowerType::Arrow);
            }
            _ => panic!("Wrong operation type"),
        }
    }

    #[test]
    fn test_message_serialization() {
        let msg = Message::FindGameRequest {
            user_chain: ChainId::root(0),
        };

        let serialized = serde_json::to_string(&msg).unwrap();
        let deserialized: Message = serde_json::from_str(&serialized).unwrap();

        match deserialized {
            Message::FindGameRequest { user_chain } => {
                assert_eq!(user_chain, ChainId::root(0));
            }
            _ => panic!("Wrong message type"),
        }
    }

    #[test]
    fn test_event_serialization() {
        let owner = AccountOwner::from([0u8; 32]);
        let event = TowerDefenseEvent::EnemyKilled {
            enemy_id: 42,
            killed_by: owner,
            gold_reward: 100,
        };

        let serialized = serde_json::to_string(&event).unwrap();
        let deserialized: TowerDefenseEvent = serde_json::from_str(&serialized).unwrap();

        match deserialized {
            TowerDefenseEvent::EnemyKilled {
                enemy_id,
                killed_by,
                gold_reward,
            } => {
                assert_eq!(enemy_id, 42);
                assert_eq!(killed_by, owner);
                assert_eq!(gold_reward, 100);
            }
            _ => panic!("Wrong event type"),
        }
    }
}
