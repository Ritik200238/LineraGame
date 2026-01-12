pub mod state;
pub mod contract;
pub mod service;
pub mod guards;

use async_graphql::{Request, Response};
use linera_sdk::linera_base_types::{ChainId, ContractAbi, ServiceAbi, AccountOwner};
use serde::{Deserialize, Serialize};
use tower_defense_abi::*;

pub use state::*;
pub use contract::TowerDefenseContract;
pub use service::TowerDefenseService;

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

    /// Place a tower at a position
    PlaceTower {
        position_x: u8,
        position_y: u8,
        tower_type: TowerType
    },

    /// Upgrade an existing tower
    UpgradeTower {
        tower_id: u64
    },

    /// Sell a tower for gold
    SellTower {
        tower_id: u64
    },

    /// Start the next wave
    StartWave {},

    // ===== Master Operations =====
    /// Add a new public chain to the registry (master only)
    AddPublicChain {
        public_chain_id: ChainId,
        region: String
    },
}

/// Responses from operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationResponse {
    Ok,
    FindGameStarted,
    TowerPlaced { tower_id: u64 },
    TowerUpgraded { tower_id: u64, new_level: u8 },
    TowerSold { tower_id: u64, refund: u64 },
    WaveStarted { wave_number: u32 },
}

/// Cross-chain messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    /// Request to find a game (user chain -> public chain)
    FindGameRequest {
        user_chain: ChainId
    },

    /// Response with game chain assignment (public chain -> user chain)
    FindGameResult {
        game_chain: Option<ChainId>
    },

    /// Game tick for processing game logic
    GameTick {
        delta_time_micros: u64
    },

    /// Report final scores to master chain (game chain -> master chain)
    ReportScore {
        scores: Vec<PlayerScore>
    },
}

/// Events emitted by the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TowerDefenseEvent {
    TowerPlaced {
        tower_id: u64,
        tower: Tower
    },

    TowerUpgraded {
        tower_id: u64,
        new_level: u8
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
    },

    WaveCompleted {
        wave_number: u32,
        bonus_gold: u64
    },

    GameOver {
        victory: bool,
        final_wave: u32,
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
            Operation::PlaceTower { position, tower_type } => {
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
            TowerDefenseEvent::EnemyKilled { enemy_id, killed_by, gold_reward } => {
                assert_eq!(enemy_id, 42);
                assert_eq!(killed_by, owner);
                assert_eq!(gold_reward, 100);
            }
            _ => panic!("Wrong event type"),
        }
    }
}
