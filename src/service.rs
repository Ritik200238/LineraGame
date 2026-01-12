#![cfg_attr(target_arch = "wasm32", no_main)]

use async_graphql::{
    EmptyMutation, EmptySubscription, Object, Schema, SimpleObject,
};
use linera_sdk::{
    linera_base_types::{WithServiceAbi, AccountOwner},
    views::View,
    Service, ServiceRuntime,
};
use std::sync::Arc;
use tower_defense_abi::*;
use crate::{state::*, TowerDefenseParameters};

pub struct TowerDefenseService {
    state: Arc<TowerDefenseState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(TowerDefenseService);

impl WithServiceAbi for TowerDefenseService {
    type Abi = crate::TowerDefenseAbi;
}

impl Service for TowerDefenseService {
    type Parameters = TowerDefenseParameters;

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = TowerDefenseState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        TowerDefenseService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: async_graphql::Request) -> async_graphql::Response {
        let schema = Schema::build(
            QueryRoot {
                state: self.state.clone(),
                runtime: self.runtime.clone(),
            },
            // Mutations are executed via contract operations, not service queries
            EmptyMutation,
            EmptySubscription,
        )
        .finish();

        schema.execute(request).await
    }
}

#[allow(dead_code)]
pub struct QueryRoot {
    state: Arc<TowerDefenseState>,
    runtime: Arc<ServiceRuntime<TowerDefenseService>>,
}


// ===== GraphQL Queries =====
// Note: Mutations are executed via contract operations, not via GraphQL service

#[Object]
impl QueryRoot {
    // ===== Game State Queries =====

    async fn game_status(&self) -> String {
        format!("{:?}", self.state.game_status.get())
    }

    async fn wave_number(&self) -> i32 {
        *self.state.wave_number.get() as i32
    }

    async fn wave_active(&self) -> bool {
        *self.state.wave_active.get()
    }

    async fn base_health(&self) -> i32 {
        *self.state.base_health.get() as i32
    }

    async fn shared_gold(&self) -> String {
        self.state.shared_gold.get().to_string()
    }

    async fn grid(&self) -> GridData {
        let grid = self.state.grid.get();
        GridData {
            width: grid.width as i32,
            height: grid.height as i32,
            path: grid.path.iter().map(|(x, y)| vec![*x as i32, *y as i32]).collect(),
            spawn_point: vec![grid.spawn_point.0 as i32, grid.spawn_point.1 as i32],
            base_point: vec![grid.base_point.0 as i32, grid.base_point.1 as i32],
        }
    }

    async fn game_config(&self) -> GameConfigData {
        let config = self.state.game_config.get();
        GameConfigData {
            grid_width: config.grid_width as i32,
            grid_height: config.grid_height as i32,
            starting_gold: config.starting_gold.to_string(),
            base_health: config.base_health as i32,
            max_towers: config.max_towers as i32,
        }
    }

    // ===== Tower Queries =====

    async fn towers(&self) -> Vec<TowerData> {
        let indices = self.state.towers.indices().await
            .expect("Failed to get tower indices");

        let mut towers = Vec::new();
        for id in indices {
            if let Some(tower) = self.state.towers.get(&id).await
                .expect("Failed to get tower") {
                towers.push(TowerData::from(tower));
            }
        }
        towers
    }

    async fn tower(&self, tower_id: String) -> Option<TowerData> {
        let id = tower_id.parse::<u64>().ok()?;
        let tower = self.state.towers.get(&id).await
            .expect("Failed to get tower")?;
        Some(TowerData::from(tower))
    }

    async fn tower_count(&self) -> i32 {
        self.state.towers.count().await
            .expect("Failed to count towers") as i32
    }

    // ===== Enemy Queries =====

    async fn enemies(&self) -> Vec<EnemyData> {
        let indices = self.state.enemies.indices().await
            .expect("Failed to get enemy indices");

        let mut enemies = Vec::new();
        for id in indices {
            if let Some(enemy) = self.state.enemies.get(&id).await
                .expect("Failed to get enemy") {
                enemies.push(EnemyData::from(enemy));
            }
        }
        enemies
    }

    async fn enemy(&self, enemy_id: String) -> Option<EnemyData> {
        let id = enemy_id.parse::<u64>().ok()?;
        let enemy = self.state.enemies.get(&id).await
            .expect("Failed to get enemy")?;
        Some(EnemyData::from(enemy))
    }

    async fn enemy_count(&self) -> i32 {
        self.state.enemies.count().await
            .expect("Failed to count enemies") as i32
    }

    // ===== Player Queries =====

    async fn players(&self) -> Vec<PlayerData> {
        let indices = self.state.players.indices().await
            .expect("Failed to get player indices");

        let mut players = Vec::new();
        for owner in indices {
            if let Some(stats) = self.state.players.get(&owner).await
                .expect("Failed to get player stats") {
                players.push(PlayerData::from_stats(owner, stats));
            }
        }
        players
    }

    async fn player(&self, owner: String) -> Option<PlayerData> {
        // TODO: AccountOwner changed to an enum (Ed25519PublicKey, etc)
        // Player lookup by hex string needs reimplementation
        let _ = owner;
        None
    }

    // ===== User Profile Queries =====

    async fn player_profile(&self) -> PlayerProfileData {
        let profile = self.state.profile.get();
        PlayerProfileData {
            name: profile.name.clone(),
            balance: profile.balance.to_string(),
            games_played: profile.games_played as i32,
            highest_wave: profile.highest_wave as i32,
            total_kills: profile.total_kills.to_string(),
            created_at: profile.created_at.to_string(),
        }
    }

    async fn user_status(&self) -> String {
        format!("{:?}", self.state.user_status.get())
    }

    async fn unlocked_towers(&self) -> Vec<String> {
        self.state.unlocked_towers.get()
            .iter()
            .map(|t| format!("{:?}", t))
            .collect()
    }

    async fn current_game_chain(&self) -> Option<String> {
        self.state.current_game_chain.get()
            .as_ref()
            .map(|chain| format!("{:?}", chain))
    }

    // ===== Leaderboard Queries =====

    async fn leaderboard(&self, limit: Option<i32>) -> Vec<LeaderboardEntryData> {
        let limit = limit.unwrap_or(100).min(100) as usize;
        let indices = self.state.leaderboard.indices().await
            .expect("Failed to get leaderboard indices");

        let mut entries = Vec::new();
        for owner in indices.into_iter().take(limit) {
            if let Some(entry) = self.state.leaderboard.get(&owner).await
                .expect("Failed to get leaderboard entry") {
                entries.push(LeaderboardEntryData::from(entry));
            }
        }

        // Sort by highest wave (descending)
        entries.sort_by(|a, b| {
            let a_wave = a.highest_wave.parse::<u32>().unwrap_or(0);
            let b_wave = b.highest_wave.parse::<u32>().unwrap_or(0);
            b_wave.cmp(&a_wave)
        });

        entries
    }

    async fn leaderboard_entry(&self, owner: String) -> Option<LeaderboardEntryData> {
        // TODO: AccountOwner changed to an enum (Ed25519PublicKey, etc)
        // Leaderboard lookup by hex string needs reimplementation
        let _ = owner;
        None
    }

    async fn season(&self) -> SeasonData {
        let season = self.state.season.get();
        SeasonData {
            season_id: season.season_id as i32,
            start_time: season.start_time.to_string(),
            end_time: season.end_time.to_string(),
        }
    }

    // ===== Room Info Queries =====

    async fn room_info(&self) -> RoomInfoData {
        let room = self.state.room_info.get();
        RoomInfoData {
            game_chain: format!("{:?}", room.game_chain),
            player_count: room.player_count as i32,
            max_players: room.max_players as i32,
            wave_number: room.wave_number as i32,
            is_public: room.is_public,
        }
    }

    // ===== Public Chain Queries =====

    async fn public_chains(&self) -> Vec<PublicChainData> {
        let indices = self.state.public_chains.indices().await
            .expect("Failed to get public chain indices");

        let mut chains = Vec::new();
        for chain_id in indices {
            if let Some(info) = self.state.public_chains.get(&chain_id).await
                .expect("Failed to get public chain info") {
                chains.push(PublicChainData {
                    chain_id: format!("{:?}", info.chain_id),
                    region: info.region.clone(),
                    active_games: info.active_games as i32,
                    available_slots: info.available_slots as i32,
                });
            }
        }
        chains
    }
}

// ===== GraphQL Response Types =====

#[derive(SimpleObject)]
pub struct TowerData {
    pub id: String,
    pub position: Vec<i32>,
    pub tower_type: String,
    pub level: i32,
    pub damage: i32,
    pub range: i32,
    pub fire_rate_ms: String,
    pub total_damage_dealt: String,
}

impl From<Tower> for TowerData {
    fn from(tower: Tower) -> Self {
        Self {
            id: tower.id.to_string(),
            position: vec![tower.position.0 as i32, tower.position.1 as i32],
            tower_type: format!("{:?}", tower.tower_type),
            level: tower.level as i32,
            damage: tower.stats.damage as i32,
            range: tower.stats.range as i32,
            fire_rate_ms: tower.stats.fire_rate_ms.to_string(),
            total_damage_dealt: tower.total_damage_dealt.to_string(),
        }
    }
}

#[derive(SimpleObject)]
pub struct EnemyData {
    pub id: String,
    pub enemy_type: String,
    pub position: Vec<f64>,
    pub path_index: i32,
    pub health: i32,
    pub max_health: i32,
    pub speed: f64,
    pub gold_reward: String,
    pub slow_multiplier: f64,
}

impl From<Enemy> for EnemyData {
    fn from(enemy: Enemy) -> Self {
        Self {
            id: enemy.id.to_string(),
            enemy_type: format!("{:?}", enemy.enemy_type),
            position: vec![enemy.position.0 as f64, enemy.position.1 as f64],
            path_index: enemy.path_index as i32,
            health: enemy.health as i32,
            max_health: enemy.max_health as i32,
            speed: enemy.speed as f64,
            gold_reward: enemy.gold_reward.to_string(),
            slow_multiplier: enemy.slow_multiplier as f64,
        }
    }
}

#[derive(SimpleObject)]
pub struct PlayerData {
    pub owner: String,
    pub chain_id: String,
    pub kills: i32,
    pub damage_dealt: String,
    pub towers_placed: Vec<String>,
    pub gold_spent: String,
}

impl PlayerData {
    fn from_stats(owner: AccountOwner, stats: PlayerGameStats) -> Self {
        Self {
            owner: format!("{:?}", owner),
            chain_id: format!("{:?}", stats.chain_id),
            kills: stats.kills as i32,
            damage_dealt: stats.damage_dealt.to_string(),
            towers_placed: stats.towers_placed.iter().map(|id| id.to_string()).collect(),
            gold_spent: stats.gold_spent.to_string(),
        }
    }
}

#[derive(SimpleObject)]
pub struct PlayerProfileData {
    pub name: String,
    pub balance: String,
    pub games_played: i32,
    pub highest_wave: i32,
    pub total_kills: String,
    pub created_at: String,
}

#[derive(SimpleObject)]
pub struct LeaderboardEntryData {
    pub player: String,
    pub chain_id: String,
    pub highest_wave: String,
    pub total_kills: String,
    pub total_games: String,
    pub total_damage: String,
    pub last_updated: String,
}

impl From<LeaderboardEntry> for LeaderboardEntryData {
    fn from(entry: LeaderboardEntry) -> Self {
        Self {
            player: format!("{:?}", entry.player),
            chain_id: format!("{:?}", entry.chain_id),
            highest_wave: entry.highest_wave.to_string(),
            total_kills: entry.total_kills.to_string(),
            total_games: entry.total_games.to_string(),
            total_damage: entry.total_damage.to_string(),
            last_updated: entry.last_updated.to_string(),
        }
    }
}

#[derive(SimpleObject)]
pub struct GridData {
    pub width: i32,
    pub height: i32,
    pub path: Vec<Vec<i32>>,
    pub spawn_point: Vec<i32>,
    pub base_point: Vec<i32>,
}

#[derive(SimpleObject)]
pub struct GameConfigData {
    pub grid_width: i32,
    pub grid_height: i32,
    pub starting_gold: String,
    pub base_health: i32,
    pub max_towers: i32,
}

#[derive(SimpleObject)]
pub struct SeasonData {
    pub season_id: i32,
    pub start_time: String,
    pub end_time: String,
}

#[derive(SimpleObject)]
pub struct RoomInfoData {
    pub game_chain: String,
    pub player_count: i32,
    pub max_players: i32,
    pub wave_number: i32,
    pub is_public: bool,
}

#[derive(SimpleObject)]
pub struct PublicChainData {
    pub chain_id: String,
    pub region: String,
    pub active_games: i32,
    pub available_slots: i32,
}
