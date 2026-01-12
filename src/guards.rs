/// Security guards and validation utilities
use linera_sdk::linera_base_types::{ChainId, AccountOwner};
use crate::{state::TowerDefenseState, TowerDefenseParameters};

/// Maximum string lengths to prevent state bloat
pub const MAX_REGION_LENGTH: usize = 100;
pub const MAX_PLAYER_NAME_LENGTH: usize = 50;

/// Game limits
pub const MAX_TOWERS_PER_PLAYER: usize = 20;
pub const MAX_GAME_TICKS: u64 = 10000; // Max 1000 seconds of gameplay
pub const WAVE_START_COOLDOWN_MICROS: u64 = 5_000_000; // 5 seconds
pub const MAX_WAVE_NUMBER: u32 = 100;

/// Rate limiting (operations per player per minute)
pub const PLACE_TOWER_RATE_LIMIT: u32 = 10;
pub const UPGRADE_TOWER_RATE_LIMIT: u32 = 20;

/// Admin validation
pub fn ensure_admin(chain_id: ChainId, params: &TowerDefenseParameters) -> Result<(), &'static str> {
    if chain_id != params.master_chain {
        return Err("Unauthorized: Only master chain can perform this operation");
    }
    Ok(())
}

/// Validate string length
pub fn validate_string_length(s: &str, max_len: usize, field_name: &str) -> Result<(), String> {
    if s.len() > max_len {
        return Err(format!("{} exceeds maximum length of {}", field_name, max_len));
    }
    Ok(())
}

/// Validate tower ownership
pub async fn ensure_tower_owner(
    state: &TowerDefenseState,
    tower_id: u64,
    owner: AccountOwner,
) -> Result<(), &'static str> {
    let tower_owner = state.tower_owners.get(&tower_id).await
        .map_err(|_| "Failed to get tower owner")?
        .ok_or("Tower not found")?;

    if tower_owner != owner {
        return Err("Unauthorized: You don't own this tower");
    }

    Ok(())
}

/// Check if player has reached tower limit
/// Returns Ok if player doesn't exist yet (allows first tower placement)
pub async fn check_tower_limit(
    state: &TowerDefenseState,
    owner: AccountOwner,
) -> Result<(), &'static str> {
    // Allow first tower - player stats may not exist yet
    let stats = match state.players.get(&owner).await {
        Ok(Some(stats)) => stats,
        Ok(None) => return Ok(()), // First tower, allow it
        Err(_) => return Err("Failed to get player stats"),
    };

    if stats.towers_placed.len() >= MAX_TOWERS_PER_PLAYER {
        return Err("Tower limit reached. Sell some towers first.");
    }

    Ok(())
}

/// Validate wave start timing
pub fn validate_wave_timing(
    last_wave_time: u64,
    current_time: u64,
) -> Result<(), &'static str> {
    let elapsed = current_time.saturating_sub(last_wave_time);
    if elapsed < WAVE_START_COOLDOWN_MICROS {
        return Err("Please wait before starting next wave");
    }
    Ok(())
}

/// Check if game should timeout
pub fn should_timeout(tick_count: u64) -> bool {
    tick_count >= MAX_GAME_TICKS
}

/// Validate wave number
pub fn validate_wave_number(wave: u32) -> Result<(), &'static str> {
    if wave > MAX_WAVE_NUMBER {
        return Err("Maximum wave limit reached. Victory!");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use linera_sdk::base::ChainId;

    #[test]
    fn test_validate_string_length() {
        assert!(validate_string_length("short", 10, "test").is_ok());
        assert!(validate_string_length("very long string that exceeds limit", 10, "test").is_err());
    }

    #[test]
    fn test_validate_wave_timing() {
        assert!(validate_wave_timing(0, 6_000_000).is_ok()); // 6 seconds later
        assert!(validate_wave_timing(0, 3_000_000).is_err()); // 3 seconds (too soon)
    }

    #[test]
    fn test_should_timeout() {
        assert!(!should_timeout(100));
        assert!(should_timeout(MAX_GAME_TICKS));
        assert!(should_timeout(MAX_GAME_TICKS + 1));
    }

    #[test]
    fn test_validate_wave_number() {
        assert!(validate_wave_number(50).is_ok());
        assert!(validate_wave_number(MAX_WAVE_NUMBER).is_ok());
        assert!(validate_wave_number(MAX_WAVE_NUMBER + 1).is_err());
    }
}
