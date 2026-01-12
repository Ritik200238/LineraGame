use crate::enemy::{Enemy, EnemyType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveConfig {
    pub base_enemy_count: u32,
    pub enemy_count_per_wave: u32,
    pub boss_wave_interval: u32,
}

impl Default for WaveConfig {
    fn default() -> Self {
        Self {
            base_enemy_count: 10,
            enemy_count_per_wave: 2,
            boss_wave_interval: 10,
        }
    }
}

pub fn generate_wave(wave_number: u32, spawn_point: (u8, u8)) -> Vec<Enemy> {
    let config = WaveConfig::default();
    let mut enemies = Vec::new();

    // Calculate total enemy count for this wave
    let enemy_count = config.base_enemy_count
        .saturating_add(wave_number.saturating_mul(config.enemy_count_per_wave));

    // Check if this is a boss wave
    let is_boss_wave = wave_number % config.boss_wave_interval == 0;

    let mut enemy_id = 0u64;

    if is_boss_wave {
        // Boss wave: 1 boss + supporting enemies
        enemies.push(Enemy::new(
            enemy_id,
            EnemyType::Boss,
            wave_number,
            spawn_point,
        ));
        enemy_id += 1;

        // Add supporting enemies (tanks and heavy soldiers)
        let support_count = (enemy_count / 2).max(3);
        for _ in 0..support_count {
            enemies.push(Enemy::new(
                enemy_id,
                EnemyType::Tank,
                wave_number,
                spawn_point,
            ));
            enemy_id += 1;
        }
    } else {
        // Regular wave: mix of enemy types based on wave number
        distribute_enemies(wave_number, enemy_count, spawn_point, &mut enemies, &mut enemy_id);
    }

    enemies
}

fn distribute_enemies(
    wave_number: u32,
    enemy_count: u32,
    spawn_point: (u8, u8),
    enemies: &mut Vec<Enemy>,
    enemy_id: &mut u64,
) {
    // Wave difficulty progression affects enemy type distribution
    match wave_number {
        1..=3 => {
            // Early waves: mostly basic scouts and some fast runners
            for _ in 0..(enemy_count * 7 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::BasicScout, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 3 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::FastRunner, wave_number, spawn_point));
                *enemy_id += 1;
            }
        }
        4..=6 => {
            // Mid-early waves: introduce heavy soldiers
            for _ in 0..(enemy_count * 4 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::BasicScout, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 3 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::FastRunner, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 3 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::HeavySoldier, wave_number, spawn_point));
                *enemy_id += 1;
            }
        }
        7..=9 => {
            // Mid waves: introduce tanks
            for _ in 0..(enemy_count * 3 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::BasicScout, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 2 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::FastRunner, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 3 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::HeavySoldier, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 2 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::Tank, wave_number, spawn_point));
                *enemy_id += 1;
            }
        }
        _ => {
            // Late waves: balanced mix with more tanks
            for _ in 0..(enemy_count * 2 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::BasicScout, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 2 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::FastRunner, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 3 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::HeavySoldier, wave_number, spawn_point));
                *enemy_id += 1;
            }
            for _ in 0..(enemy_count * 3 / 10) {
                enemies.push(Enemy::new(*enemy_id, EnemyType::Tank, wave_number, spawn_point));
                *enemy_id += 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wave_generation() {
        let enemies = generate_wave(1, (0, 0));
        assert!(!enemies.is_empty());

        // Wave 1 should have base_enemy_count + 1 * enemy_count_per_wave = 10 + 2 = 12 enemies
        assert_eq!(enemies.len(), 12);
    }

    #[test]
    fn test_wave_scaling() {
        let wave1 = generate_wave(1, (0, 0));
        let wave5 = generate_wave(5, (0, 0));
        let wave10 = generate_wave(10, (0, 0));

        // Each wave should have more enemies
        assert!(wave5.len() > wave1.len());
        assert!(wave10.len() > wave5.len());
    }

    #[test]
    fn test_boss_wave() {
        let wave10 = generate_wave(10, (0, 0));

        // Wave 10 should be a boss wave
        let has_boss = wave10.iter().any(|e| e.enemy_type == EnemyType::Boss);
        assert!(has_boss);
    }

    #[test]
    fn test_non_boss_wave() {
        let wave5 = generate_wave(5, (0, 0));

        // Wave 5 should not have a boss
        let has_boss = wave5.iter().any(|e| e.enemy_type == EnemyType::Boss);
        assert!(!has_boss);
    }

    #[test]
    fn test_early_wave_composition() {
        let wave2 = generate_wave(2, (0, 0));

        // Early waves should be mostly BasicScout and FastRunner
        let basic_count = wave2.iter().filter(|e| e.enemy_type == EnemyType::BasicScout).count();
        let fast_count = wave2.iter().filter(|e| e.enemy_type == EnemyType::FastRunner).count();
        let heavy_count = wave2.iter().filter(|e| e.enemy_type == EnemyType::HeavySoldier).count();
        let tank_count = wave2.iter().filter(|e| e.enemy_type == EnemyType::Tank).count();

        assert!(basic_count > 0);
        assert!(fast_count > 0 || basic_count > 0);
        assert_eq!(heavy_count, 0); // No heavy soldiers in early waves
        assert_eq!(tank_count, 0); // No tanks in early waves
    }

    #[test]
    fn test_mid_wave_composition() {
        let wave7 = generate_wave(7, (0, 0));

        // Mid waves should have all enemy types except boss
        let has_basic = wave7.iter().any(|e| e.enemy_type == EnemyType::BasicScout);
        let has_fast = wave7.iter().any(|e| e.enemy_type == EnemyType::FastRunner);
        let has_heavy = wave7.iter().any(|e| e.enemy_type == EnemyType::HeavySoldier);
        let has_tank = wave7.iter().any(|e| e.enemy_type == EnemyType::Tank);

        assert!(has_basic || has_fast || has_heavy || has_tank);
    }

    #[test]
    fn test_unique_enemy_ids() {
        let wave = generate_wave(5, (0, 0));

        // All enemy IDs should be unique
        let mut ids: Vec<u64> = wave.iter().map(|e| e.id).collect();
        ids.sort();
        ids.dedup();

        assert_eq!(ids.len(), wave.len());
    }

    #[test]
    fn test_spawn_position() {
        let spawn = (5, 10);
        let wave = generate_wave(3, spawn);

        // All enemies should spawn at the correct position
        for enemy in wave {
            assert_eq!(enemy.position, (spawn.0 as f32, spawn.1 as f32));
            assert_eq!(enemy.path_index, 0);
        }
    }
}
