use async_graphql::Enum;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, Enum)]
pub enum TowerType {
    Arrow,
    Cannon,
    Magic,
    Ice,
    Lightning,
}

impl TowerType {
    pub fn cost(&self) -> u64 {
        match self {
            Self::Arrow => 100,
            Self::Cannon => 250,
            Self::Magic => 200,
            Self::Ice => 150,
            Self::Lightning => 300,
        }
    }

    pub fn base_stats(&self) -> TowerStats {
        match self {
            Self::Arrow => TowerStats {
                damage: 10,
                range: 3,
                fire_rate_ms: 500,
            },
            Self::Cannon => TowerStats {
                damage: 50,
                range: 4,
                fire_rate_ms: 2000,
            },
            Self::Magic => TowerStats {
                damage: 15,
                range: 2,
                fire_rate_ms: 1000,
            },
            Self::Ice => TowerStats {
                damage: 5,
                range: 3,
                fire_rate_ms: 800,
            },
            Self::Lightning => TowerStats {
                damage: 30,
                range: 3,
                fire_rate_ms: 1500,
            },
        }
    }

    pub fn upgrade_cost(&self, level: u8) -> Option<u64> {
        match (self, level) {
            (Self::Arrow, 2) => Some(150),
            (Self::Arrow, 3) => Some(250),
            (Self::Cannon, 2) => Some(300),
            (Self::Cannon, 3) => Some(500),
            (Self::Magic, 2) => Some(250),
            (Self::Magic, 3) => Some(400),
            (Self::Ice, 2) => Some(200),
            (Self::Ice, 3) => Some(350),
            (Self::Lightning, 2) => Some(400),
            (Self::Lightning, 3) => Some(600),
            _ => None,
        }
    }

    pub fn sell_value(&self, level: u8) -> u64 {
        let mut total_cost = self.cost();
        for lvl in 2..=level {
            if let Some(upgrade_cost) = self.upgrade_cost(lvl) {
                total_cost = total_cost.saturating_add(upgrade_cost);
            }
        }
        ((total_cost as f64) * 0.7) as u64
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TowerStats {
    pub damage: u32,
    pub range: u8,
    pub fire_rate_ms: u64,
}

impl TowerStats {
    pub fn upgraded(&self, level: u8) -> Self {
        match level {
            1 => *self,
            2 => Self {
                damage: self.damage.saturating_add(self.damage / 2), // +50%
                range: self.range,
                fire_rate_ms: ((self.fire_rate_ms as f32) * 0.9) as u64, // -10% (faster)
            },
            3 => Self {
                damage: self.damage.saturating_mul(2), // +100%
                range: self.range.saturating_add(1),
                fire_rate_ms: ((self.fire_rate_ms as f32) * 0.8) as u64, // -20% (faster)
            },
            _ => *self,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tower {
    pub id: u64,
    pub position: (u8, u8),
    pub tower_type: TowerType,
    pub level: u8,
    pub stats: TowerStats,
    pub last_shot_micros: u64,
    pub total_damage_dealt: u64,
}

impl Tower {
    pub fn new(id: u64, position: (u8, u8), tower_type: TowerType, current_time_micros: u64) -> Self {
        Self {
            id,
            position,
            tower_type,
            level: 1,
            stats: tower_type.base_stats(),
            last_shot_micros: current_time_micros,
            total_damage_dealt: 0,
        }
    }

    pub fn can_fire(&self, current_time_micros: u64) -> bool {
        current_time_micros.saturating_sub(self.last_shot_micros) >= self.stats.fire_rate_ms.saturating_mul(1000)
    }

    pub fn upgrade(&mut self) -> Result<(), &'static str> {
        if self.level >= 3 {
            return Err("Tower already at max level");
        }
        self.level = self.level.saturating_add(1);
        self.stats = self.tower_type.base_stats().upgraded(self.level);
        Ok(())
    }

    pub fn distance_to(&self, pos: (f32, f32)) -> f32 {
        let dx = pos.0 - (self.position.0 as f32);
        let dy = pos.1 - (self.position.1 as f32);
        (dx * dx + dy * dy).sqrt()
    }

    pub fn in_range(&self, pos: (f32, f32)) -> bool {
        self.distance_to(pos) <= (self.stats.range as f32)
    }

    pub fn record_damage(&mut self, damage: u64) {
        self.total_damage_dealt = self.total_damage_dealt.saturating_add(damage);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tower_costs() {
        assert_eq!(TowerType::Arrow.cost(), 100);
        assert_eq!(TowerType::Cannon.cost(), 250);
        assert_eq!(TowerType::Magic.cost(), 200);
        assert_eq!(TowerType::Ice.cost(), 150);
        assert_eq!(TowerType::Lightning.cost(), 300);
    }

    #[test]
    fn test_tower_upgrade_cost() {
        let tower_type = TowerType::Arrow;
        assert_eq!(tower_type.upgrade_cost(2), Some(150));
        assert_eq!(tower_type.upgrade_cost(3), Some(250));
        assert_eq!(tower_type.upgrade_cost(4), None);
    }

    #[test]
    fn test_tower_sell_value() {
        let tower_type = TowerType::Arrow;
        // Level 1: 100 * 0.7 = 70
        assert_eq!(tower_type.sell_value(1), 70);
        // Level 2: (100 + 150) * 0.7 = 175
        assert_eq!(tower_type.sell_value(2), 175);
        // Level 3: (100 + 150 + 250) * 0.7 = 350
        assert_eq!(tower_type.sell_value(3), 350);
    }

    #[test]
    fn test_tower_stats_upgrade() {
        let base_stats = TowerType::Arrow.base_stats();
        assert_eq!(base_stats.damage, 10);

        let lvl2_stats = base_stats.upgraded(2);
        assert_eq!(lvl2_stats.damage, 15); // 10 + 5 (50%)

        let lvl3_stats = base_stats.upgraded(3);
        assert_eq!(lvl3_stats.damage, 20); // 10 * 2
        assert_eq!(lvl3_stats.range, 4); // 3 + 1
    }

    #[test]
    fn test_tower_creation() {
        let tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);
        assert_eq!(tower.id, 0);
        assert_eq!(tower.position, (5, 5));
        assert_eq!(tower.level, 1);
        assert_eq!(tower.stats.damage, 10);
    }

    #[test]
    fn test_tower_in_range() {
        let tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);
        // Range is 3 tiles
        assert!(tower.in_range((5.0, 7.0))); // Within range
        assert!(tower.in_range((8.0, 5.0))); // Within range
        assert!(!tower.in_range((10.0, 10.0))); // Out of range
    }

    #[test]
    fn test_tower_upgrade() {
        let mut tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);
        assert_eq!(tower.level, 1);
        assert_eq!(tower.stats.damage, 10);

        // Upgrade to level 2
        assert!(tower.upgrade().is_ok());
        assert_eq!(tower.level, 2);
        assert_eq!(tower.stats.damage, 15);

        // Upgrade to level 3
        assert!(tower.upgrade().is_ok());
        assert_eq!(tower.level, 3);
        assert_eq!(tower.stats.damage, 20);

        // Cannot upgrade past level 3
        assert!(tower.upgrade().is_err());
        assert_eq!(tower.level, 3);
    }

    #[test]
    fn test_tower_can_fire() {
        let tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);
        // Fire rate is 500ms = 500,000 microseconds

        assert!(tower.can_fire(500_000)); // Can fire after 500ms
        assert!(!tower.can_fire(400_000)); // Cannot fire before cooldown
    }
}
