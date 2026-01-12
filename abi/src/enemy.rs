use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EnemyType {
    BasicScout,
    HeavySoldier,
    FastRunner,
    Tank,
    Boss,
}

impl EnemyType {
    pub fn base_stats(&self, wave: u32) -> EnemyStats {
        let health_mult = 1.0 + ((wave as f32) * 0.1);

        match self {
            Self::BasicScout => EnemyStats {
                health: (50.0 * health_mult) as u32,
                speed: 1.0,
                gold_reward: 10,
                damage_to_base: 1,
            },
            Self::HeavySoldier => EnemyStats {
                health: (150.0 * health_mult) as u32,
                speed: 0.7,
                gold_reward: 25,
                damage_to_base: 2,
            },
            Self::FastRunner => EnemyStats {
                health: (40.0 * health_mult) as u32,
                speed: 1.8,
                gold_reward: 15,
                damage_to_base: 1,
            },
            Self::Tank => EnemyStats {
                health: (500.0 * health_mult) as u32,
                speed: 0.5,
                gold_reward: 50,
                damage_to_base: 5,
            },
            Self::Boss => EnemyStats {
                health: 2000_u32.saturating_add(wave.saturating_mul(100)),
                speed: 0.8,
                gold_reward: 200,
                damage_to_base: 10,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct EnemyStats {
    pub health: u32,
    pub speed: f32,
    pub gold_reward: u64,
    pub damage_to_base: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Enemy {
    pub id: u64,
    pub enemy_type: EnemyType,
    pub position: (f32, f32),
    pub path_index: usize,
    pub health: u32,
    pub max_health: u32,
    pub speed: f32,
    pub gold_reward: u64,
    pub damage_to_base: u32,
    pub slow_multiplier: f32,
}

impl Enemy {
    pub fn new(id: u64, enemy_type: EnemyType, wave: u32, spawn_pos: (u8, u8)) -> Self {
        let stats = enemy_type.base_stats(wave);
        Self {
            id,
            enemy_type,
            position: (spawn_pos.0 as f32, spawn_pos.1 as f32),
            path_index: 0,
            health: stats.health,
            max_health: stats.health,
            speed: stats.speed,
            gold_reward: stats.gold_reward,
            damage_to_base: stats.damage_to_base,
            slow_multiplier: 1.0,
        }
    }

    pub fn is_alive(&self) -> bool {
        self.health > 0
    }

    pub fn effective_speed(&self) -> f32 {
        self.speed * self.slow_multiplier
    }

    pub fn take_damage(&mut self, damage: u32) -> bool {
        self.health = self.health.saturating_sub(damage);
        !self.is_alive()
    }

    pub fn apply_slow(&mut self, multiplier: f32) {
        self.slow_multiplier = multiplier.min(self.slow_multiplier);
    }

    pub fn reset_slow(&mut self) {
        self.slow_multiplier = 1.0;
    }

    pub fn health_percentage(&self) -> f32 {
        if self.max_health == 0 {
            0.0
        } else {
            (self.health as f32) / (self.max_health as f32)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enemy_type_stats() {
        let stats = EnemyType::BasicScout.base_stats(1);
        assert_eq!(stats.health, 55); // 50 * 1.1
        assert_eq!(stats.speed, 1.0);
        assert_eq!(stats.gold_reward, 10);
        assert_eq!(stats.damage_to_base, 1);
    }

    #[test]
    fn test_enemy_type_stats_scaling() {
        let wave1_stats = EnemyType::BasicScout.base_stats(1);
        let wave5_stats = EnemyType::BasicScout.base_stats(5);

        // Wave 5 should have more health than wave 1
        assert!(wave5_stats.health > wave1_stats.health);
    }

    #[test]
    fn test_boss_health_scaling() {
        let wave1_boss = EnemyType::Boss.base_stats(1);
        let wave10_boss = EnemyType::Boss.base_stats(10);

        assert_eq!(wave1_boss.health, 2100); // 2000 + 100
        assert_eq!(wave10_boss.health, 3000); // 2000 + 1000
    }

    #[test]
    fn test_enemy_creation() {
        let enemy = Enemy::new(0, EnemyType::BasicScout, 1, (0, 0));
        assert_eq!(enemy.id, 0);
        assert_eq!(enemy.enemy_type, EnemyType::BasicScout);
        assert_eq!(enemy.position, (0.0, 0.0));
        assert_eq!(enemy.path_index, 0);
        assert!(enemy.is_alive());
        assert_eq!(enemy.slow_multiplier, 1.0);
    }

    #[test]
    fn test_enemy_take_damage() {
        let mut enemy = Enemy::new(0, EnemyType::BasicScout, 1, (0, 0));
        let initial_health = enemy.health;

        // Take some damage but survive
        let killed = enemy.take_damage(30);
        assert!(!killed);
        assert!(enemy.is_alive());
        assert_eq!(enemy.health, initial_health - 30);

        // Take fatal damage
        let killed = enemy.take_damage(100);
        assert!(killed);
        assert!(!enemy.is_alive());
        assert_eq!(enemy.health, 0);
    }

    #[test]
    fn test_enemy_slow() {
        let mut enemy = Enemy::new(0, EnemyType::BasicScout, 1, (0, 0));
        assert_eq!(enemy.effective_speed(), 1.0);

        // Apply slow (30% reduction)
        enemy.apply_slow(0.7);
        assert_eq!(enemy.slow_multiplier, 0.7);
        assert_eq!(enemy.effective_speed(), 0.7);

        // Apply stronger slow (should keep the stronger one)
        enemy.apply_slow(0.5);
        assert_eq!(enemy.slow_multiplier, 0.5);
        assert_eq!(enemy.effective_speed(), 0.5);

        // Reset slow
        enemy.reset_slow();
        assert_eq!(enemy.slow_multiplier, 1.0);
        assert_eq!(enemy.effective_speed(), 1.0);
    }

    #[test]
    fn test_enemy_health_percentage() {
        let mut enemy = Enemy::new(0, EnemyType::BasicScout, 1, (0, 0));
        assert_eq!(enemy.health_percentage(), 1.0);

        enemy.take_damage(enemy.max_health / 2);
        assert!((enemy.health_percentage() - 0.5).abs() < 0.1);

        enemy.take_damage(enemy.max_health);
        assert_eq!(enemy.health_percentage(), 0.0);
    }

    #[test]
    fn test_different_enemy_types() {
        let scout = Enemy::new(0, EnemyType::BasicScout, 1, (0, 0));
        let heavy = Enemy::new(1, EnemyType::HeavySoldier, 1, (0, 0));
        let runner = Enemy::new(2, EnemyType::FastRunner, 1, (0, 0));
        let tank = Enemy::new(3, EnemyType::Tank, 1, (0, 0));
        let boss = Enemy::new(4, EnemyType::Boss, 1, (0, 0));

        // Check health progression
        assert!(scout.health < heavy.health);
        assert!(heavy.health < tank.health);
        assert!(tank.health < boss.health);

        // Check speed differences
        assert!(runner.speed > scout.speed);
        assert!(scout.speed > heavy.speed);
        assert!(heavy.speed > tank.speed);
    }
}
