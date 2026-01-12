use linera_sdk::views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext};
use linera_sdk::linera_base_types::{ChainId, AccountOwner};
use serde::{Deserialize, Serialize};
use tower_defense_abi::*;

/// Main application state using Linera's View system
/// This state structure supports all chain types (Master/Public/Game/User)
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct TowerDefenseState {
    // ===== Universal Fields (All Chain Types) =====
    /// Global token pool for rewards
    pub token_pool: RegisterView<u64>,

    /// Public chains registry
    pub public_chains: MapView<ChainId, PublicChainInfo>,

    // ===== User Chain Fields =====
    /// Player profile
    pub profile: RegisterView<PlayerProfile>,

    /// Current player status
    pub user_status: RegisterView<UserStatus>,

    /// Current game chain (if in game)
    pub current_game_chain: RegisterView<Option<ChainId>>,

    /// Tower unlocks (progression)
    pub unlocked_towers: RegisterView<Vec<TowerType>>,

    // ===== Game Chain Fields =====
    /// Game configuration
    pub game_config: RegisterView<GameConfig>,

    /// Game status
    pub game_status: RegisterView<GameStatus>,

    /// Current wave number
    pub wave_number: RegisterView<u32>,

    /// Wave active flag
    pub wave_active: RegisterView<bool>,

    /// Base health
    pub base_health: RegisterView<u32>,

    /// Shared gold pool
    pub shared_gold: RegisterView<u64>,

    /// Grid layout
    pub grid: RegisterView<Grid>,

    /// Placed towers (indexed by tower ID)
    pub towers: MapView<u64, Tower>,

    /// Tower ownership (tower_id -> owner)
    pub tower_owners: MapView<u64,  AccountOwner>,

    /// Active enemies (indexed by enemy ID)
    pub enemies: MapView<u64, Enemy>,

    /// Players in this game
    pub players: MapView<AccountOwner, PlayerGameStats>,

    /// Game tick counter (for timeout detection)
    pub game_tick_count: RegisterView<u64>,

    /// Last wave start time (for cooldown)
    pub last_wave_start_time: RegisterView<u64>,

    /// Room info (for public discovery)
    pub room_info: RegisterView<RoomInfo>,

    // ===== Public Chain Fields =====
    /// Active game chains grouped by player count
    pub games_by_player_count: MapView<u8, Vec<ChainId>>,

    /// Available game chains
    pub available_game_chains: RegisterView<Vec<ChainId>>,

    // ===== Master Chain Fields =====
    /// Leaderboard entries
    pub leaderboard: MapView<AccountOwner, LeaderboardEntry>,

    /// Season configuration
    pub season: RegisterView<Season>,
}

/// User status on their personal chain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UserStatus {
    Idle,
    FindingGame,
    GameFound,
    InGame,
}

impl Default for UserStatus {
    fn default() -> Self {
        Self::Idle
    }
}

/// Player profile (stored on user chain)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerProfile {
    pub name: String,
    pub balance: u64,
    pub games_played: u32,
    pub highest_wave: u32,
    pub total_kills: u64,
    pub created_at: u64,
}

impl Default for PlayerProfile {
    fn default() -> Self {
        Self {
            name: String::new(),
            balance: 1000, // Starting balance
            games_played: 0,
            highest_wave: 0,
            total_kills: 0,
            created_at: 0,
        }
    }
}

/// Player stats within a game (stored on game chain)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerGameStats {
    pub owner: AccountOwner,
    pub chain_id: ChainId,
    pub kills: u32,
    pub damage_dealt: u64,
    pub towers_placed: Vec<u64>,
    pub gold_spent: u64,
}

impl PlayerGameStats {
    pub fn new(owner: AccountOwner, chain_id: ChainId) -> Self {
        Self {
            owner,
            chain_id,
            kills: 0,
            damage_dealt: 0,
            towers_placed: Vec::new(),
            gold_spent: 0,
        }
    }
}

/// Public chain information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicChainInfo {
    pub chain_id: ChainId,
    pub region: String,
    pub active_games: u32,
    pub available_slots: u32,
}

/// Room information for matchmaking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomInfo {
    pub game_chain: Option<ChainId>,
    pub player_count: u8,
    pub max_players: u8,
    pub wave_number: u32,
    pub is_public: bool,
}

impl Default for RoomInfo {
    fn default() -> Self {
        Self {
            game_chain: None,
            player_count: 0,
            max_players: 4,
            wave_number: 0,
            is_public: true,
        }
    }
}

/// Leaderboard entry (stored on master chain)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub player: AccountOwner,
    pub chain_id: ChainId,
    pub highest_wave: u32,
    pub total_kills: u64,
    pub total_games: u32,
    pub total_damage: u64,
    pub last_updated: u64,
}

/// Season configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Season {
    pub season_id: u32,
    pub start_time: u64,
    pub end_time: u64,
}

impl Default for Season {
    fn default() -> Self {
        Self {
            season_id: 1,
            start_time: 0,
            end_time: 0,
        }
    }
}

/// Player score for cross-chain reporting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerScore {
    pub owner: AccountOwner,
    pub chain_id: ChainId,
    pub wave_reached: u32,
    pub kills: u32,
    pub damage_dealt: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_status_default() {
        let status = UserStatus::default();
        assert_eq!(status, UserStatus::Idle);
    }

    #[test]
    fn test_player_profile_default() {
        let profile = PlayerProfile::default();
        assert_eq!(profile.balance, 1000);
        assert_eq!(profile.games_played, 0);
    }

    #[test]
    fn test_player_game_stats_new() {
        let owner = AccountOwner::from([0u8; 32]);
        let chain_id = ChainId::root(0);

        let stats = PlayerGameStats::new(owner, chain_id);

        assert_eq!(stats.owner, owner);
        assert_eq!(stats.chain_id, chain_id);
        assert_eq!(stats.kills, 0);
        assert_eq!(stats.damage_dealt, 0);
        assert_eq!(stats.towers_placed.len(), 0);
        assert_eq!(stats.gold_spent, 0);
    }

    #[test]
    fn test_room_info_default() {
        let room = RoomInfo::default();
        assert_eq!(room.player_count, 0);
        assert_eq!(room.max_players, 4);
        assert_eq!(room.wave_number, 0);
        assert!(room.is_public);
    }

    #[test]
    fn test_season_default() {
        let season = Season::default();
        assert_eq!(season.season_id, 1);
        assert_eq!(season.start_time, 0);
        assert_eq!(season.end_time, 0);
    }
}
