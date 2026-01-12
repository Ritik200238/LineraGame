use crate::enemy::EnemyType;
use crate::tower::TowerType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomyConfig {
    pub starting_gold: u64,
    pub wave_completion_bonus: u64,
    pub tower_sell_ratio: f64, // Percentage of total investment returned when selling
}

impl Default for EconomyConfig {
    fn default() -> Self {
        Self {
            starting_gold: 500,
            wave_completion_bonus: 50,
            tower_sell_ratio: 0.7, // 70% return
        }
    }
}

/// Calculate gold reward for killing an enemy
pub fn calculate_kill_reward(enemy_type: EnemyType, wave_number: u32) -> u64 {
    let base_reward = match enemy_type {
        EnemyType::BasicScout => 10,
        EnemyType::FastRunner => 15,
        EnemyType::HeavySoldier => 25,
        EnemyType::Tank => 50,
        EnemyType::Boss => 200,
    };

    // Bonus gold for later waves (10% per wave)
    let wave_multiplier = 1.0 + ((wave_number as f64 - 1.0) * 0.1);
    ((base_reward as f64) * wave_multiplier) as u64
}

/// Calculate total cost of a tower including all upgrades
pub fn calculate_tower_total_cost(tower_type: TowerType, level: u8) -> u64 {
    let mut total = tower_type.cost();

    for lvl in 2..=level {
        if let Some(upgrade_cost) = tower_type.upgrade_cost(lvl) {
            total = total.saturating_add(upgrade_cost);
        }
    }

    total
}

/// Calculate sell value for a tower
pub fn calculate_sell_value(tower_type: TowerType, level: u8, config: &EconomyConfig) -> u64 {
    let total_cost = calculate_tower_total_cost(tower_type, level);
    ((total_cost as f64) * config.tower_sell_ratio) as u64
}

/// Calculate wave completion bonus
pub fn calculate_wave_bonus(wave_number: u32, config: &EconomyConfig) -> u64 {
    // Base bonus + 10 gold per wave
    config.wave_completion_bonus.saturating_add(wave_number.saturating_mul(10) as u64)
}

/// Check if player can afford a purchase
pub fn can_afford(current_gold: u64, cost: u64) -> bool {
    current_gold >= cost
}

/// Calculate total value of all towers on the field
pub fn calculate_total_tower_value(towers: &[(TowerType, u8)]) -> u64 {
    towers
        .iter()
        .map(|(tower_type, level)| calculate_tower_total_cost(*tower_type, *level))
        .sum()
}

/// Calculate efficiency score (damage per gold spent)
pub fn calculate_tower_efficiency(tower_type: TowerType, level: u8) -> f64 {
    let cost = calculate_tower_total_cost(tower_type, level);
    let stats = tower_type.base_stats().upgraded(level);

    // Simple efficiency: damage per gold
    // Factor in fire rate (damage per second)
    let dps = (stats.damage as f64) / ((stats.fire_rate_ms as f64) / 1000.0);

    if cost == 0 {
        0.0
    } else {
        dps / (cost as f64)
    }
}

/// Recommend tower purchase based on current gold and strategy
pub fn recommend_tower(current_gold: u64, strategy: Strategy) -> Option<TowerType> {
    let affordable_towers: Vec<TowerType> = vec![
        TowerType::Arrow,
        TowerType::Ice,
        TowerType::Magic,
        TowerType::Cannon,
        TowerType::Lightning,
    ]
    .into_iter()
    .filter(|t| can_afford(current_gold, t.cost()))
    .collect();

    if affordable_towers.is_empty() {
        return None;
    }

    match strategy {
        Strategy::Efficiency => {
            // Return most efficient tower
            affordable_towers
                .into_iter()
                .max_by(|a, b| {
                    let eff_a = calculate_tower_efficiency(*a, 1);
                    let eff_b = calculate_tower_efficiency(*b, 1);
                    eff_a.partial_cmp(&eff_b).unwrap_or(std::cmp::Ordering::Equal)
                })
        }
        Strategy::MaxDamage => {
            // Return highest damage tower
            affordable_towers
                .into_iter()
                .max_by_key(|t| t.base_stats().damage)
        }
        Strategy::Cheapest => {
            // Return cheapest tower
            affordable_towers.into_iter().min_by_key(|t| t.cost())
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Strategy {
    Efficiency,
    MaxDamage,
    Cheapest,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_kill_reward() {
        // Wave 1 rewards
        assert_eq!(calculate_kill_reward(EnemyType::BasicScout, 1), 10);
        assert_eq!(calculate_kill_reward(EnemyType::Boss, 1), 200);

        // Wave 5 should give more gold (40% more)
        let wave1_reward = calculate_kill_reward(EnemyType::BasicScout, 1);
        let wave5_reward = calculate_kill_reward(EnemyType::BasicScout, 5);
        assert!(wave5_reward > wave1_reward);
    }

    #[test]
    fn test_calculate_tower_total_cost() {
        // Level 1 Arrow tower
        assert_eq!(calculate_tower_total_cost(TowerType::Arrow, 1), 100);

        // Level 2 Arrow tower (100 + 150)
        assert_eq!(calculate_tower_total_cost(TowerType::Arrow, 2), 250);

        // Level 3 Arrow tower (100 + 150 + 250)
        assert_eq!(calculate_tower_total_cost(TowerType::Arrow, 3), 500);
    }

    #[test]
    fn test_calculate_sell_value() {
        let config = EconomyConfig::default();

        // Level 1 Arrow tower: 100 * 0.7 = 70
        assert_eq!(calculate_sell_value(TowerType::Arrow, 1, &config), 70);

        // Level 3 Arrow tower: 500 * 0.7 = 350
        assert_eq!(calculate_sell_value(TowerType::Arrow, 3, &config), 350);
    }

    #[test]
    fn test_calculate_wave_bonus() {
        let config = EconomyConfig::default();

        // Wave 1: 50 + 10 = 60
        assert_eq!(calculate_wave_bonus(1, &config), 60);

        // Wave 5: 50 + 50 = 100
        assert_eq!(calculate_wave_bonus(5, &config), 100);

        // Wave 10: 50 + 100 = 150
        assert_eq!(calculate_wave_bonus(10, &config), 150);
    }

    #[test]
    fn test_can_afford() {
        assert!(can_afford(100, 50));
        assert!(can_afford(100, 100));
        assert!(!can_afford(100, 101));
    }

    #[test]
    fn test_calculate_total_tower_value() {
        let towers = vec![
            (TowerType::Arrow, 1),  // 100
            (TowerType::Arrow, 2),  // 250
            (TowerType::Cannon, 1), // 250
        ];

        let total = calculate_total_tower_value(&towers);
        assert_eq!(total, 600);
    }

    #[test]
    fn test_calculate_tower_efficiency() {
        // Arrow tower: 10 damage, 500ms fire rate, 100 cost
        // DPS = 10 / 0.5 = 20
        // Efficiency = 20 / 100 = 0.2
        let arrow_eff = calculate_tower_efficiency(TowerType::Arrow, 1);
        assert!(arrow_eff > 0.0);

        // Cannon tower: 50 damage, 2000ms fire rate, 250 cost
        // DPS = 50 / 2.0 = 25
        // Efficiency = 25 / 250 = 0.1
        let cannon_eff = calculate_tower_efficiency(TowerType::Cannon, 1);
        assert!(cannon_eff > 0.0);

        // Arrow should be more efficient than Cannon
        assert!(arrow_eff > cannon_eff);
    }

    #[test]
    fn test_recommend_tower_efficiency() {
        let gold = 1000;
        let recommendation = recommend_tower(gold, Strategy::Efficiency);

        assert!(recommendation.is_some());
        // Should recommend an efficient tower
    }

    #[test]
    fn test_recommend_tower_max_damage() {
        let gold = 1000;
        let recommendation = recommend_tower(gold, Strategy::MaxDamage);

        assert!(recommendation.is_some());
        let tower = recommendation.unwrap();

        // With 1000 gold, all towers are affordable
        // Lightning has highest base damage (30)
        assert_eq!(tower, TowerType::Lightning);
    }

    #[test]
    fn test_recommend_tower_cheapest() {
        let gold = 150;
        let recommendation = recommend_tower(gold, Strategy::Cheapest);

        assert!(recommendation.is_some());
        let tower = recommendation.unwrap();

        // Arrow is cheapest at 100
        assert_eq!(tower, TowerType::Arrow);
    }

    #[test]
    fn test_recommend_tower_insufficient_gold() {
        let gold = 50; // Not enough for any tower
        let recommendation = recommend_tower(gold, Strategy::Efficiency);

        assert!(recommendation.is_none());
    }

    #[test]
    fn test_economy_config_default() {
        let config = EconomyConfig::default();

        assert_eq!(config.starting_gold, 500);
        assert_eq!(config.wave_completion_bonus, 50);
        assert_eq!(config.tower_sell_ratio, 0.7);
    }
}
