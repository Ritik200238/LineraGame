#![cfg_attr(target_arch = "wasm32", no_main)]

use crate::{
    guards, state::*, Message, Operation, OperationResponse, TowerDefenseEvent,
    TowerDefenseParameters,
};
use linera_sdk::{
    linera_base_types::{AccountOwner, ChainId, Timestamp, WithContractAbi},
    views::{RootView, View},
    Contract, ContractRuntime,
};
use tower_defense_abi::*;

pub struct TowerDefenseContract {
    state: TowerDefenseState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(TowerDefenseContract);

impl WithContractAbi for TowerDefenseContract {
    type Abi = crate::TowerDefenseAbi;
}

impl Contract for TowerDefenseContract {
    type Message = Message;
    type Parameters = TowerDefenseParameters;
    type InstantiationArgument = ();
    type EventValue = TowerDefenseEvent;

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = TowerDefenseState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        TowerDefenseContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        // Minimal initialization - just set basic defaults
        // Chain type detection and complex initialization happens on first operation
        self.state.user_status.set(UserStatus::Idle);
        self.state.profile.set(PlayerProfile {
            name: String::new(),
            balance: 1000,
            games_played: 0,
            highest_wave: 0,
            total_kills: 0,
            created_at: 0,
        });
        self.state
            .unlocked_towers
            .set(vec![TowerType::Arrow, TowerType::Cannon]);
        self.state.game_config.set(GameConfig::default());
        self.state.game_status.set(GameStatus::Lobby);
        self.state.wave_number.set(0);
        self.state.wave_active.set(false);
        self.state.base_health.set(20);
        self.state.shared_gold.set(500);
        self.state.grid.set(Grid::new());
        self.state.room_info.set(RoomInfo::default());
        self.state.multiplayer_game.set(None);
        self.state.game_tick_count.set(0);
        self.state.last_wave_start_time.set(0);
        self.state.season.set(Season {
            season_id: 1,
            start_time: 0,
            end_time: 0,
        });
    }

    async fn execute_operation(&mut self, operation: Operation) -> OperationResponse {
        // Early return if no authenticated signer (happens during app creation)
        let owner = match self.runtime.authenticated_signer() {
            Some(owner) => owner,
            None => return OperationResponse::Ok,
        };
        let current_time = self.runtime.system_time();
        let chain_id = self.runtime.chain_id();

        match operation {
            Operation::FindGame {} => self.handle_find_game(owner, chain_id).await,

            Operation::CreateGame {
                mode,
                max_players,
                is_private,
            } => {
                self.handle_create_game(owner, chain_id, mode, max_players, is_private)
                    .await
            }

            Operation::JoinGame { game_id } => {
                self.handle_join_game(owner, chain_id, game_id).await
            }

            Operation::SetPlayerReady { ready } => {
                self.handle_set_player_ready(owner, ready).await
            }

            Operation::LeaveGame {} => self.handle_leave_game(owner).await,

            Operation::PlaceTower {
                position_x,
                position_y,
                tower_type,
            } => {
                self.handle_place_tower(owner, (position_x, position_y), tower_type, current_time)
                    .await
            }

            Operation::UpgradeTower { tower_id } => {
                self.handle_upgrade_tower(owner, tower_id).await
            }

            Operation::SellTower { tower_id } => self.handle_sell_tower(owner, tower_id).await,

            Operation::StartWave {} => self.handle_start_wave(current_time).await,

            Operation::AddPublicChain {
                public_chain_id,
                region,
            } => self.handle_add_public_chain(public_chain_id, region).await,
        }
    }

    async fn execute_message(&mut self, message: Message) {
        match message {
            Message::FindGameRequest { user_chain } => {
                self.handle_find_game_request(user_chain).await;
            }

            Message::FindGameResult { game_chain } => {
                self.handle_find_game_result(game_chain).await;
            }

            Message::CreateGameRequest {
                mode,
                max_players,
                is_private,
                player_name,
                user_chain,
            } => {
                self.handle_create_game_request(
                    mode,
                    max_players,
                    is_private,
                    player_name,
                    user_chain,
                )
                .await;
            }

            Message::CreateGameResult { game_id, success } => {
                self.handle_create_game_result(game_id, success).await;
            }

            Message::JoinGameRequest {
                game_id,
                player_name,
                user_chain,
            } => {
                self.handle_join_game_request(game_id, player_name, user_chain)
                    .await;
            }

            Message::JoinGameResult {
                game_id,
                success,
                error,
            } => {
                self.handle_join_game_result(game_id, success, error).await;
            }

            Message::PlayerReadyUpdate {
                game_id,
                player_id,
                ready,
            } => {
                self.handle_player_ready_update(game_id, player_id, ready)
                    .await;
            }

            Message::StartGameRequest { game_id } => {
                self.handle_start_game_request(game_id).await;
            }

            Message::LeaveGameRequest {
                game_id,
                player_id,
            } => {
                self.handle_leave_game_request(game_id, player_id).await;
            }

            Message::TowerPlacedNotification {
                game_id,
                player_id,
                tower_id,
                position,
                tower_type,
            } => {
                self.handle_tower_placed_notification(
                    game_id, player_id, tower_id, position, tower_type,
                )
                .await;
            }

            Message::WaveStartedNotification {
                game_id,
                player_id,
                wave_number,
            } => {
                self.handle_wave_started_notification(game_id, player_id, wave_number)
                    .await;
            }

            Message::PlayerDamagedNotification {
                game_id,
                player_id,
                damage,
                remaining_health,
            } => {
                self.handle_player_damaged_notification(game_id, player_id, damage, remaining_health)
                    .await;
            }

            Message::PlayerDefeatedNotification {
                game_id,
                player_id,
            } => {
                self.handle_player_defeated_notification(game_id, player_id)
                    .await;
            }

            Message::GameTick { delta_time_micros } => {
                self.handle_game_tick(delta_time_micros).await;
            }

            Message::GameVictoryNotification {
                game_id,
                winner,
                final_rankings,
            } => {
                self.handle_game_victory_notification(game_id, winner, final_rankings)
                    .await;
            }

            Message::ReportScore { scores } => {
                self.handle_report_score(scores).await;
            }

            Message::SyncGameState { game_id } => {
                self.handle_sync_game_state(game_id).await;
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl TowerDefenseContract {
    // ===== Operation Handlers =====

    async fn handle_create_game(
        &mut self,
        owner: AccountOwner,
        user_chain: ChainId,
        mode: GameMode,
        max_players: u8,
        is_private: bool,
    ) -> OperationResponse {
        // Get player profile for name
        let profile = self.state.profile.get();
        let player_name = if profile.name.is_empty() {
            format!("Player_{}", &format!("{:?}", owner)[..8])
        } else {
            profile.name.clone()
        };

        // Send CreateGameRequest to game chain (self)
        let game_chain = self.runtime.chain_id();
        self.send_message(
            game_chain,
            Message::CreateGameRequest {
                mode,
                max_players,
                is_private,
                player_name,
                user_chain,
            },
        );

        // Update user status
        self.state.user_status.set(UserStatus::FindingGame);

        OperationResponse::Ok
    }

    async fn handle_join_game(
        &mut self,
        owner: AccountOwner,
        user_chain: ChainId,
        game_id: String,
    ) -> OperationResponse {
        // Get player profile for name
        let profile = self.state.profile.get();
        let player_name = if profile.name.is_empty() {
            format!("Player_{}", &format!("{:?}", owner)[..8])
        } else {
            profile.name.clone()
        };

        // Get game chain from current_game_chain or use self chain
        let game_chain = self
            .state
            .current_game_chain
            .get()
            .as_ref()
            .copied()
            .unwrap_or(self.runtime.chain_id());

        // Send JoinGameRequest to game chain
        self.send_message(
            game_chain,
            Message::JoinGameRequest {
                game_id,
                player_name,
                user_chain,
            },
        );

        // Update user status
        self.state.user_status.set(UserStatus::FindingGame);

        OperationResponse::Ok
    }

    async fn handle_set_player_ready(
        &mut self,
        owner: AccountOwner,
        ready: bool,
    ) -> OperationResponse {
        // Get current game info
        let game_chain = self
            .state
            .current_game_chain
            .get()
            .as_ref()
            .copied()
            .unwrap_or(self.runtime.chain_id());

        // Get multiplayer game to extract game_id
        let mp_game = self.state.multiplayer_game.get();
        let game_id = match mp_game.as_ref() {
            Some(game) => game.game_id.clone(),
            None => return OperationResponse::Ok, // No active game
        };

        // Send PlayerReadyUpdate to game chain
        self.send_message(
            game_chain,
            Message::PlayerReadyUpdate {
                game_id,
                player_id: owner,
                ready,
            },
        );

        OperationResponse::PlayerReadyUpdated { ready }
    }

    async fn handle_leave_game(&mut self, _owner: AccountOwner) -> OperationResponse {
        // Reset user status
        self.state.user_status.set(UserStatus::Idle);
        self.state.current_game_chain.set(None);

        OperationResponse::LeftGame
    }

    async fn handle_find_game(
        &mut self,
        _owner: AccountOwner,
        user_chain: ChainId,
    ) -> OperationResponse {
        // Validate state
        let status = self.state.user_status.get();
        if *status != UserStatus::Idle {
            panic!("User already in game or searching");
        }

        // Update status
        self.state.user_status.set(UserStatus::FindingGame);

        // Send message to public chain
        let params = self.runtime.application_parameters();
        let public_chain = params
            .public_chains
            .first()
            .expect("No public chains configured");

        self.send_message(*public_chain, Message::FindGameRequest { user_chain });

        OperationResponse::FindGameStarted
    }

    async fn handle_place_tower(
        &mut self,
        owner: AccountOwner,
        position: (u8, u8),
        tower_type: TowerType,
        current_time: Timestamp,
    ) -> OperationResponse {
        // 1. Check tower limit FIRST (cheap operation before expensive state reads)
        guards::check_tower_limit(&self.state, owner)
            .await
            .map_err(|e| panic!("{}", e))
            .unwrap();

        // Get grid
        let grid = self.state.grid.get();

        // Validation (panic-based for atomic rollback)
        if !grid.is_valid_position(position) {
            panic!("Position out of bounds");
        }

        if grid.is_on_path(position) {
            panic!("Cannot place tower on enemy path");
        }

        // Check if position is occupied
        let tower_ids = self
            .state
            .towers
            .indices()
            .await
            .expect("Failed to get towers");
        for tower_id in tower_ids {
            let tower = self
                .state
                .towers
                .get(&tower_id)
                .await
                .expect("Failed to get tower")
                .expect("Tower not found");
            if tower.position == position {
                panic!("Position already occupied");
            }
        }

        // Check gold
        let cost = tower_type.cost();
        let mut gold = *self.state.shared_gold.get();
        if gold < cost {
            panic!("Insufficient gold");
        }

        // Check unlocked
        let unlocked = self.state.unlocked_towers.get();
        if !unlocked.contains(&tower_type) {
            panic!("Tower type not unlocked");
        }

        // Deduct gold
        gold = gold.saturating_sub(cost);
        self.state.shared_gold.set(gold);

        // Create tower
        let tower_id = self
            .state
            .towers
            .count()
            .await
            .expect("Failed to count towers");
        let tower = Tower::new(tower_id as u64, position, tower_type, current_time.micros());

        // Save tower
        self.state
            .towers
            .insert(&(tower_id as u64), tower.clone())
            .expect("Failed to insert tower");

        // Store ownership (SECURITY FIX)
        self.state
            .tower_owners
            .insert(&(tower_id as u64), owner)
            .expect("Failed to store tower ownership");

        // Update player stats
        let mut stats = self
            .state
            .players
            .get(&owner)
            .await
            .expect("Failed to get player stats")
            .unwrap_or_else(|| PlayerGameStats::new(owner, self.runtime.chain_id()));
        stats.towers_placed.push(tower_id as u64);
        stats.gold_spent = stats.gold_spent.saturating_add(cost);
        self.state
            .players
            .insert(&owner, stats)
            .expect("Failed to update player stats");

        // Emit event
        self.emit_event(TowerDefenseEvent::TowerPlaced {
            tower_id: tower_id as u64,
            tower: tower.clone(),
            player_id: Some(owner),
        });

        OperationResponse::TowerPlaced {
            tower_id: tower_id as u64,
        }
    }

    async fn handle_upgrade_tower(
        &mut self,
        owner: AccountOwner,
        tower_id: u64,
    ) -> OperationResponse {
        // 1. Verify ownership FIRST (SECURITY FIX)
        guards::ensure_tower_owner(&self.state, tower_id, owner)
            .await
            .map_err(|e| panic!("{}", e))
            .unwrap();

        // Get tower
        let mut tower = self
            .state
            .towers
            .get(&tower_id)
            .await
            .expect("Failed to get tower")
            .expect("Tower not found");

        // Check upgrade cost
        let cost = tower
            .tower_type
            .upgrade_cost(tower.level.saturating_add(1))
            .expect("Tower at max level or invalid level");

        // Check gold
        let mut gold = *self.state.shared_gold.get();
        if gold < cost {
            panic!("Insufficient gold for upgrade");
        }

        // Deduct gold
        gold = gold.saturating_sub(cost);
        self.state.shared_gold.set(gold);

        // Upgrade tower
        tower.upgrade().expect("Failed to upgrade tower");

        // Save tower
        self.state
            .towers
            .insert(&tower_id, tower.clone())
            .expect("Failed to update tower");

        // Update player stats
        let mut stats = self
            .state
            .players
            .get(&owner)
            .await
            .expect("Failed to get player stats")
            .expect("Player stats not found");
        stats.gold_spent = stats.gold_spent.saturating_add(cost);
        self.state
            .players
            .insert(&owner, stats)
            .expect("Failed to update player stats");

        // Emit event
        self.emit_event(TowerDefenseEvent::TowerUpgraded {
            tower_id,
            new_level: tower.level,
        });

        OperationResponse::TowerUpgraded {
            tower_id,
            new_level: tower.level,
        }
    }

    async fn handle_sell_tower(&mut self, owner: AccountOwner, tower_id: u64) -> OperationResponse {
        // 1. Verify ownership FIRST (SECURITY FIX)
        guards::ensure_tower_owner(&self.state, tower_id, owner)
            .await
            .map_err(|e| panic!("{}", e))
            .unwrap();

        // Get tower
        let tower = self
            .state
            .towers
            .get(&tower_id)
            .await
            .expect("Failed to get tower")
            .expect("Tower not found");

        // Calculate refund
        let refund = tower.tower_type.sell_value(tower.level);

        // Add gold
        let mut gold = *self.state.shared_gold.get();
        gold = gold.saturating_add(refund);
        self.state.shared_gold.set(gold);

        // Remove tower
        self.state
            .towers
            .remove(&tower_id)
            .expect("Failed to remove tower");

        // Remove ownership record (SECURITY FIX)
        self.state
            .tower_owners
            .remove(&tower_id)
            .expect("Failed to remove tower ownership");

        // Emit event
        self.emit_event(TowerDefenseEvent::TowerSold { tower_id, refund });

        OperationResponse::TowerSold { tower_id, refund }
    }

    async fn handle_start_wave(&mut self, current_time: Timestamp) -> OperationResponse {
        // Validate state
        let wave_active = *self.state.wave_active.get();
        if wave_active {
            panic!("Wave already active");
        }

        // Increment wave number
        let wave_number = *self.state.wave_number.get();
        let new_wave = wave_number.saturating_add(1);

        // 1. Check wave limit (SECURITY FIX)
        guards::validate_wave_number(new_wave)
            .map_err(|e| panic!("{}", e))
            .unwrap();

        // 2. Check cooldown (SECURITY FIX)
        let last_wave_time = *self.state.last_wave_start_time.get();
        guards::validate_wave_timing(last_wave_time, current_time.micros())
            .map_err(|e| panic!("{}", e))
            .unwrap();

        // 3. Update last wave time (SECURITY FIX)
        self.state.last_wave_start_time.set(current_time.micros());

        // 4. Reset tick counter (SECURITY FIX)
        self.state.game_tick_count.set(0);

        self.state.wave_number.set(new_wave);
        self.state.wave_active.set(true);

        // Generate enemies
        let grid = self.state.grid.get();
        let enemies = wave::generate_wave(new_wave, grid.spawn_point);

        let enemy_count = enemies.len();

        // Insert enemies
        for enemy in enemies {
            let id = enemy.id;
            self.state
                .enemies
                .insert(&id, enemy)
                .expect("Failed to insert enemy");
        }

        // Emit event
        self.emit_event(TowerDefenseEvent::WaveStarted {
            wave_number: new_wave,
            enemy_count,
            player_id: None, // Single player or game chain initiated
        });

        // Schedule game tick
        self.schedule_game_tick(100_000); // 100ms

        OperationResponse::WaveStarted {
            wave_number: new_wave,
        }
    }

    async fn handle_add_public_chain(
        &mut self,
        public_chain_id: ChainId,
        region: String,
    ) -> OperationResponse {
        // 1. Validate admin (SECURITY FIX - using guards module)
        let params = self.runtime.application_parameters();
        guards::ensure_admin(self.runtime.chain_id(), &params)
            .map_err(|e| panic!("{}", e))
            .unwrap();

        // 2. Validate input (SECURITY FIX - prevent state bloat)
        guards::validate_string_length(&region, guards::MAX_REGION_LENGTH, "region")
            .map_err(|e| panic!("{}", e))
            .unwrap();

        let info = PublicChainInfo {
            chain_id: public_chain_id,
            region,
            active_games: 0,
            available_slots: 1000,
        };

        self.state
            .public_chains
            .insert(&public_chain_id, info)
            .expect("Failed to insert public chain");

        OperationResponse::Ok
    }

    // ===== Message Handlers =====

    async fn handle_find_game_request(&mut self, user_chain: ChainId) {
        // This runs on public chain - find available game or create/assign one

        // Get available game chains from state
        let available = self.state.available_game_chains.get().clone();

        let game_chain = if available.is_empty() {
            // No dedicated game chains - use this chain as the game chain
            // In production, you'd create a new game chain here
            Some(self.runtime.chain_id())
        } else {
            // Find a game with available slots (less than 4 players)
            let mut found_chain = None;
            for chain_id in available.iter() {
                // Check games by player count
                if let Ok(Some(chains)) = self.state.games_by_player_count.get(&0).await {
                    if chains.contains(chain_id) {
                        found_chain = Some(*chain_id);
                        break;
                    }
                }
                if let Ok(Some(chains)) = self.state.games_by_player_count.get(&1).await {
                    if chains.contains(chain_id) {
                        found_chain = Some(*chain_id);
                        break;
                    }
                }
                if let Ok(Some(chains)) = self.state.games_by_player_count.get(&2).await {
                    if chains.contains(chain_id) {
                        found_chain = Some(*chain_id);
                        break;
                    }
                }
                if let Ok(Some(chains)) = self.state.games_by_player_count.get(&3).await {
                    if chains.contains(chain_id) {
                        found_chain = Some(*chain_id);
                        break;
                    }
                }
            }
            found_chain.or(Some(self.runtime.chain_id()))
        };

        self.send_message(user_chain, Message::FindGameResult { game_chain });
    }

    async fn handle_find_game_result(&mut self, game_chain: Option<ChainId>) {
        // This runs on user chain
        if let Some(chain) = game_chain {
            self.state.current_game_chain.set(Some(chain));
            self.state.user_status.set(UserStatus::InGame);
        } else {
            self.state.user_status.set(UserStatus::Idle);
        }
    }

    async fn handle_game_tick(&mut self, delta_time_micros: u64) {
        use combat::*;

        // 1. Increment and check timeout FIRST (SECURITY FIX)
        let tick_count = *self.state.game_tick_count.get();
        if guards::should_timeout(tick_count) {
            // Auto-defeat on timeout (prevents infinite loops)
            self.finalize_game(false).await;
            return;
        }
        self.state.game_tick_count.set(tick_count.saturating_add(1));

        // 2. Check if base already destroyed (SECURITY FIX - prevent double-finalize)
        if *self.state.base_health.get() == 0 {
            return; // Already finalized, don't schedule more ticks
        }

        let current_time = self.runtime.system_time().micros();

        // Update enemies (movement)
        let grid = self.state.grid.get();
        let enemy_ids: Vec<u64> = self
            .state
            .enemies
            .indices()
            .await
            .expect("Failed to get enemy indices");

        for enemy_id in enemy_ids.clone() {
            let mut enemy = match self
                .state
                .enemies
                .get(&enemy_id)
                .await
                .expect("Failed to get enemy")
            {
                Some(e) => e,
                None => continue,
            };

            // Move enemy
            update_enemy_position(&mut enemy, &grid.path, delta_time_micros);

            // Check if reached base
            if enemy.path_index >= grid.path.len() {
                let damage = enemy.damage_to_base;
                let mut base_health = *self.state.base_health.get();
                base_health = base_health.saturating_sub(damage);
                self.state.base_health.set(base_health);

                // Remove enemy
                self.state
                    .enemies
                    .remove(&enemy_id)
                    .expect("Failed to remove enemy");

                if base_health == 0 {
                    // Game over
                    self.finalize_game(false).await;
                    return;
                }
            } else {
                // Update enemy position
                self.state
                    .enemies
                    .insert(&enemy_id, enemy)
                    .expect("Failed to update enemy");
            }
        }

        // Tower shooting logic
        let tower_ids: Vec<u64> = self
            .state
            .towers
            .indices()
            .await
            .expect("Failed to get tower indices");

        for tower_id in tower_ids {
            let mut tower = match self
                .state
                .towers
                .get(&tower_id)
                .await
                .expect("Failed to get tower")
            {
                Some(t) => t,
                None => continue,
            };

            // Check if tower can fire
            if !tower.can_fire(current_time) {
                continue;
            }

            // Find target
            let enemy_ids: Vec<u64> = self
                .state
                .enemies
                .indices()
                .await
                .expect("Failed to get enemy indices");

            let mut enemies_with_ids = Vec::new();
            for id in enemy_ids {
                if let Some(enemy) = self
                    .state
                    .enemies
                    .get(&id)
                    .await
                    .expect("Failed to get enemy")
                {
                    enemies_with_ids.push((id, enemy));
                }
            }

            if let Some(target_id) = find_target_id(&tower, &enemies_with_ids) {
                // Fire at target
                tower.last_shot_micros = current_time;

                let mut target = self
                    .state
                    .enemies
                    .get(&target_id)
                    .await
                    .expect("Failed to get target")
                    .expect("Target not found");

                // Calculate and apply damage
                let damage = calculate_damage(&tower, &target);
                apply_tower_effects(&tower, &mut target);

                let killed = target.take_damage(damage);

                if killed {
                    // Enemy killed
                    let gold_reward = target.gold_reward;

                    // Award gold
                    let mut gold = *self.state.shared_gold.get();
                    gold = gold.saturating_add(gold_reward);
                    self.state.shared_gold.set(gold);

                    // Remove enemy
                    self.state
                        .enemies
                        .remove(&target_id)
                        .expect("Failed to remove enemy");

                    // Emit event (would need owner tracking)
                } else {
                    // Update enemy
                    self.state
                        .enemies
                        .insert(&target_id, target)
                        .expect("Failed to update enemy");
                }

                // Update tower stats
                tower.record_damage(damage as u64);
                self.state
                    .towers
                    .insert(&tower_id, tower)
                    .expect("Failed to update tower");
            }
        }

        // Check wave completion
        let enemy_count = self
            .state
            .enemies
            .count()
            .await
            .expect("Failed to count enemies");

        if enemy_count == 0 {
            // 3. Victory condition check (SECURITY FIX)
            let wave_number = *self.state.wave_number.get();
            if wave_number >= guards::MAX_WAVE_NUMBER {
                // VICTORY! Completed all 100 waves
                self.finalize_game(true).await;
                return;
            }

            self.complete_wave().await;
        } else {
            // Schedule next tick
            self.schedule_game_tick(100_000); // 100ms
        }
    }

    async fn complete_wave(&mut self) {
        self.state.wave_active.set(false);

        // Award gold
        let wave_number = *self.state.wave_number.get();
        let bonus = 50u64.saturating_add(wave_number.saturating_mul(10) as u64);

        let mut gold = *self.state.shared_gold.get();
        gold = gold.saturating_add(bonus);
        self.state.shared_gold.set(gold);

        self.emit_event(TowerDefenseEvent::WaveCompleted {
            wave_number,
            bonus_gold: bonus,
        });
    }

    async fn finalize_game(&mut self, victory: bool) {
        let status = if victory {
            GameStatus::Victory
        } else {
            GameStatus::Defeat
        };
        self.state.game_status.set(status);

        let wave_number = *self.state.wave_number.get();

        // Emit game over event
        self.emit_event(TowerDefenseEvent::GameOver {
            victory,
            final_wave: wave_number,
            winner: None, // Would need to determine winner in multiplayer
        });

        // Collect player scores
        let player_ids: Vec<AccountOwner> = self
            .state
            .players
            .indices()
            .await
            .expect("Failed to get player indices");

        let mut scores = Vec::new();
        for owner in player_ids {
            let stats = self
                .state
                .players
                .get(&owner)
                .await
                .expect("Failed to get player stats")
                .expect("Player stats not found");

            scores.push(PlayerScore {
                owner,
                chain_id: stats.chain_id,
                wave_reached: wave_number,
                kills: stats.kills,
                damage_dealt: stats.damage_dealt,
            });
        }

        // Report to master chain
        let params = self.runtime.application_parameters();
        self.send_message(params.master_chain, Message::ReportScore { scores });
    }

    async fn handle_report_score(&mut self, scores: Vec<PlayerScore>) {
        // This runs on master chain
        for score in scores {
            let mut entry = self
                .state
                .leaderboard
                .get(&score.owner)
                .await
                .expect("Failed to get leaderboard entry")
                .unwrap_or(LeaderboardEntry {
                    player: score.owner,
                    chain_id: score.chain_id,
                    highest_wave: 0,
                    total_kills: 0,
                    total_games: 0,
                    total_damage: 0,
                    last_updated: 0,
                });

            // Update stats
            if score.wave_reached > entry.highest_wave {
                entry.highest_wave = score.wave_reached;
            }
            entry.total_kills = entry.total_kills.saturating_add(score.kills as u64);
            entry.total_games = entry.total_games.saturating_add(1);
            entry.total_damage = entry.total_damage.saturating_add(score.damage_dealt);
            entry.last_updated = self.runtime.system_time().micros();

            self.state
                .leaderboard
                .insert(&score.owner, entry)
                .expect("Failed to update leaderboard");
        }
    }

    // ===== Multiplayer Message Handlers =====

    async fn handle_create_game_request(
        &mut self,
        mode: GameMode,
        max_players: u8,
        is_private: bool,
        player_name: String,
        user_chain: ChainId,
    ) {
        // This runs on game chain
        // Generate unique game ID
        let game_id = format!(
            "game_{}_{:?}",
            self.runtime.system_time().micros(),
            self.runtime.chain_id()
        );

        // Get player owner from authenticated signer (would need proper handling)
        let owner = AccountOwner::from([0u8; 32]); // Placeholder

        // Create multiplayer game
        let mp_game = MultiplayerGame::new(game_id.clone(), mode, max_players, owner);
        self.state.multiplayer_game.set(Some(mp_game.clone()));

        // Initialize first player stats
        let mut stats = PlayerGameStats::new(owner, user_chain, player_name.clone());
        stats.is_ready = false;
        self.state
            .players
            .insert(&owner, stats)
            .expect("Failed to insert player");

        // Update room info
        let mut room = self.state.room_info.get().clone();
        room.game_chain = Some(self.runtime.chain_id());
        room.player_count = 1;
        room.max_players = max_players;
        room.game_mode = mode;
        room.host_name = player_name.clone();
        room.is_public = !is_private;
        self.state.room_info.set(room);

        // Send success response to user chain
        self.send_message(
            user_chain,
            Message::CreateGameResult {
                game_id: game_id.clone(),
                success: true,
            },
        );

        // Emit event
        self.emit_event(TowerDefenseEvent::GameCreated {
            game_id,
            host: owner,
            mode,
        });
    }

    async fn handle_create_game_result(&mut self, game_id: String, success: bool) {
        // This runs on user chain
        if success {
            self.state.user_status.set(UserStatus::InGame);
            // Store game ID in profile or separate field if needed
            let _ = game_id; // Use game_id as needed
        } else {
            self.state.user_status.set(UserStatus::Idle);
        }
    }

    async fn handle_join_game_request(
        &mut self,
        game_id: String,
        player_name: String,
        user_chain: ChainId,
    ) {
        // This runs on game chain
        let mp_game = self.state.multiplayer_game.get();
        let mut game = match mp_game.as_ref() {
            Some(g) if g.game_id == game_id => g.clone(),
            _ => {
                // Game not found or wrong game ID
                self.send_message(
                    user_chain,
                    Message::JoinGameResult {
                        game_id: game_id.clone(),
                        success: false,
                        error: Some("Game not found".to_string()),
                    },
                );
                return;
            }
        };

        // Check if game is full
        let current_players = self
            .state
            .players
            .count()
            .await
            .expect("Failed to count players");
        if current_players >= game.max_players as usize {
            self.send_message(
                user_chain,
                Message::JoinGameResult {
                    game_id: game_id.clone(),
                    success: false,
                    error: Some("Game is full".to_string()),
                },
            );
            return;
        }

        // Check if game already started
        if game.status != GameStatus::Lobby {
            self.send_message(
                user_chain,
                Message::JoinGameResult {
                    game_id: game_id.clone(),
                    success: false,
                    error: Some("Game already started".to_string()),
                },
            );
            return;
        }

        // Add player
        let owner = AccountOwner::from([0u8; 32]); // Placeholder - would need proper owner from message
        let stats = PlayerGameStats::new(owner, user_chain, player_name.clone());
        self.state
            .players
            .insert(&owner, stats)
            .expect("Failed to insert player");

        // Update room info
        let mut room = self.state.room_info.get().clone();
        room.player_count = room.player_count.saturating_add(1);
        self.state.room_info.set(room);

        // Send success response
        self.send_message(
            user_chain,
            Message::JoinGameResult {
                game_id: game_id.clone(),
                success: true,
                error: None,
            },
        );

        // Emit event
        self.emit_event(TowerDefenseEvent::PlayerJoined {
            game_id,
            player_id: owner,
            player_name,
        });
    }

    async fn handle_join_game_result(
        &mut self,
        game_id: String,
        success: bool,
        error: Option<String>,
    ) {
        // This runs on user chain
        if success {
            self.state.user_status.set(UserStatus::InGame);
            let _ = game_id; // Use game_id as needed
        } else {
            self.state.user_status.set(UserStatus::Idle);
            let _ = error; // Log or display error
        }
    }

    async fn handle_player_ready_update(
        &mut self,
        game_id: String,
        player_id: AccountOwner,
        ready: bool,
    ) {
        // This runs on game chain
        // Update player ready status
        let mut stats = match self
            .state
            .players
            .get(&player_id)
            .await
            .expect("Failed to get player stats")
        {
            Some(s) => s,
            None => return,
        };

        stats.is_ready = ready;
        self.state
            .players
            .insert(&player_id, stats)
            .expect("Failed to update player stats");

        // Emit event
        self.emit_event(TowerDefenseEvent::PlayerReadyChanged {
            game_id,
            player_id,
            ready,
        });

        // Check if all players are ready
        self.check_all_players_ready().await;
    }

    async fn check_all_players_ready(&mut self) {
        let player_ids: Vec<AccountOwner> = self
            .state
            .players
            .indices()
            .await
            .expect("Failed to get player indices");

        let mut all_ready = true;
        let player_count = player_ids.len();

        for owner in player_ids {
            let stats = self
                .state
                .players
                .get(&owner)
                .await
                .expect("Failed to get player stats")
                .expect("Player not found");
            if !stats.is_ready {
                all_ready = false;
                break;
            }
        }

        // Only start if all players ready and at least 2 players
        if all_ready && player_count >= 2 {
            let mp_game = self.state.multiplayer_game.get();
            if let Some(mut game) = mp_game.as_ref().cloned() {
                game.status = GameStatus::InProgress;
                game.start_time = self.runtime.system_time().micros();
                self.state.multiplayer_game.set(Some(game.clone()));

                // Emit event
                self.emit_event(TowerDefenseEvent::GameStarted {
                    game_id: game.game_id,
                    player_count: player_count as u8,
                });
            }
        }
    }

    async fn handle_start_game_request(&mut self, game_id: String) {
        // This runs on game chain - host forcing start
        let mp_game = self.state.multiplayer_game.get();
        if let Some(mut game) = mp_game.as_ref().cloned() {
            if game.game_id == game_id && game.status == GameStatus::Lobby {
                game.status = GameStatus::InProgress;
                game.start_time = self.runtime.system_time().micros();
                self.state.multiplayer_game.set(Some(game.clone()));

                let player_count = self
                    .state
                    .players
                    .count()
                    .await
                    .expect("Failed to count players");

                self.emit_event(TowerDefenseEvent::GameStarted {
                    game_id: game.game_id,
                    player_count: player_count as u8,
                });
            }
        }
    }

    async fn handle_leave_game_request(&mut self, game_id: String, player_id: AccountOwner) {
        // This runs on game chain
        // Remove player from game
        self.state
            .players
            .remove(&player_id)
            .expect("Failed to remove player");

        // Update room info
        let mut room = self.state.room_info.get().clone();
        room.player_count = room.player_count.saturating_sub(1);
        self.state.room_info.set(room);

        // Emit event
        self.emit_event(TowerDefenseEvent::PlayerLeft {
            game_id,
            player_id,
        });
    }

    async fn handle_tower_placed_notification(
        &mut self,
        _game_id: String,
        _player_id: AccountOwner,
        _tower_id: u64,
        _position: (u8, u8),
        _tower_type: TowerType,
    ) {
        // This runs on user chains - update local UI state
        // Frontend will handle this via polling or subscriptions
    }

    async fn handle_wave_started_notification(
        &mut self,
        _game_id: String,
        _player_id: AccountOwner,
        _wave_number: u32,
    ) {
        // This runs on user chains - update local UI state
        // Frontend will handle this via polling or subscriptions
    }

    async fn handle_player_damaged_notification(
        &mut self,
        _game_id: String,
        _player_id: AccountOwner,
        _damage: u32,
        _remaining_health: u32,
    ) {
        // This runs on user chains - update local UI state
        // Frontend will handle this via polling or subscriptions
    }

    async fn handle_player_defeated_notification(
        &mut self,
        _game_id: String,
        _player_id: AccountOwner,
    ) {
        // This runs on user chains - update local UI state
        // Frontend will handle this via polling or subscriptions
    }

    async fn handle_game_victory_notification(
        &mut self,
        _game_id: String,
        _winner: Option<AccountOwner>,
        _final_rankings: Vec<(AccountOwner, u32)>,
    ) {
        // This runs on user chains - display victory screen
        // Frontend will handle this via polling or subscriptions
    }

    async fn handle_sync_game_state(&mut self, _game_id: String) {
        // This runs on user chains - sync full game state
        // Would query game chain for full state
    }

    // ===== Helper Methods =====

    fn send_message(&mut self, destination: ChainId, message: Message) {
        self.runtime
            .prepare_message(message)
            .with_tracking()
            .send_to(destination);
    }

    fn schedule_game_tick(&mut self, _delay_micros: u64) {
        // Note: with_delay was removed in linera-sdk 0.15.x
        // Messages are sent immediately - game tick timing is handled differently
        self.runtime
            .prepare_message(Message::GameTick {
                delta_time_micros: _delay_micros,
            })
            .with_tracking()
            .send_to(self.runtime.chain_id());
    }

    fn emit_event(&mut self, _event: TowerDefenseEvent) {
        // Events temporarily disabled during deployment debugging
        // TODO: Re-enable once deployment is working
        // const GAME_EVENTS: &[u8] = b"game";
        // self.runtime.emit(GAME_EVENTS.into(), &event);
    }
}
