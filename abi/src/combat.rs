use crate::enemy::Enemy;
use crate::tower::{Tower, TowerType};

/// Find the best enemy target for a tower
pub fn find_target<'a>(tower: &Tower, enemies: &'a [Enemy]) -> Option<&'a Enemy> {
    enemies
        .iter()
        .filter(|e| e.is_alive() && tower.in_range(e.position))
        .max_by_key(|e| e.path_index) // Target enemy furthest along the path
}

/// Find the best enemy target by ID for a tower
pub fn find_target_id(tower: &Tower, enemies: &[(u64, Enemy)]) -> Option<u64> {
    enemies
        .iter()
        .filter(|(_, e)| e.is_alive() && tower.in_range(e.position))
        .max_by_key(|(_, e)| e.path_index)
        .map(|(id, _)| *id)
}

/// Calculate damage to apply to an enemy from a tower
pub fn calculate_damage(tower: &Tower, enemy: &Enemy) -> u32 {
    // Base damage from tower
    let mut damage = tower.stats.damage;

    // Tower-specific effects
    match tower.tower_type {
        TowerType::Ice => {
            // Ice towers do less damage but apply slow
            damage
        }
        TowerType::Magic => {
            // Magic towers do bonus damage to tanks
            if matches!(enemy.enemy_type, crate::enemy::EnemyType::Tank) {
                damage = damage.saturating_mul(2);
            }
            damage
        }
        TowerType::Lightning => {
            // Lightning chains to multiple enemies (handled separately)
            damage
        }
        _ => damage,
    }
}

/// Apply special effects based on tower type
pub fn apply_tower_effects(tower: &Tower, enemy: &mut Enemy) {
    match tower.tower_type {
        TowerType::Ice => {
            // Ice towers slow enemies by 30%
            enemy.apply_slow(0.7);
        }
        _ => {
            // Most towers don't apply special effects
        }
    }
}

/// Update enemy position along the path
pub fn update_enemy_position(enemy: &mut Enemy, path: &[(u8, u8)], delta_time_micros: u64) {
    if enemy.path_index >= path.len() {
        return; // Enemy reached the end
    }

    let delta_seconds = (delta_time_micros as f64) / 1_000_000.0;
    let distance_to_move = enemy.effective_speed() * (delta_seconds as f32);

    let mut remaining_distance = distance_to_move;

    while remaining_distance > 0.0 && enemy.path_index < path.len() {
        let target = path[enemy.path_index];
        let target_pos = (target.0 as f32, target.1 as f32);

        let dx = target_pos.0 - enemy.position.0;
        let dy = target_pos.1 - enemy.position.1;
        let distance = (dx * dx + dy * dy).sqrt();

        if distance <= remaining_distance {
            // Reached this waypoint, move to next
            enemy.position = target_pos;
            enemy.path_index += 1;
            remaining_distance -= distance;
        } else {
            // Move towards waypoint
            let ratio = remaining_distance / distance;
            enemy.position.0 += dx * ratio;
            enemy.position.1 += dy * ratio;
            remaining_distance = 0.0;
        }
    }

    // Reset slow effect after movement (will be reapplied by towers)
    enemy.reset_slow();
}

/// Find enemies in range of a tower for chain lightning
pub fn find_chain_targets<'a>(
    tower: &Tower,
    primary_target: &Enemy,
    enemies: &'a [Enemy],
    max_chains: usize,
) -> Vec<&'a Enemy> {
    let mut targets = Vec::new();

    for enemy in enemies {
        if targets.len() >= max_chains {
            break;
        }

        if enemy.id != primary_target.id && enemy.is_alive() && tower.in_range(enemy.position) {
            targets.push(enemy);
        }
    }

    targets
}

/// Find enemies in AoE range for magic towers
pub fn find_aoe_targets<'a>(
    center: (f32, f32),
    radius: f32,
    enemies: &'a [Enemy],
) -> Vec<&'a Enemy> {
    enemies
        .iter()
        .filter(|e| {
            if !e.is_alive() {
                return false;
            }
            let dx = e.position.0 - center.0;
            let dy = e.position.1 - center.1;
            let distance = (dx * dx + dy * dy).sqrt();
            distance <= radius
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enemy::EnemyType;

    #[test]
    fn test_find_target() {
        let tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);

        let enemies = vec![
            Enemy::new(0, EnemyType::BasicScout, 1, (5, 5)),
            {
                let mut e = Enemy::new(1, EnemyType::BasicScout, 1, (6, 6));
                e.path_index = 5; // Further along
                e
            },
            {
                let mut e = Enemy::new(2, EnemyType::BasicScout, 1, (20, 20));
                e.path_index = 10; // Furthest but out of range
                e
            },
        ];

        let target = find_target(&tower, &enemies);
        assert!(target.is_some());
        // Should target enemy 1 (furthest along path within range)
        assert_eq!(target.unwrap().id, 1);
    }

    #[test]
    fn test_find_target_none() {
        let tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);

        let enemies = vec![
            {
                let mut e = Enemy::new(0, EnemyType::BasicScout, 1, (20, 20));
                e.path_index = 5; // Out of range
                e
            },
        ];

        let target = find_target(&tower, &enemies);
        assert!(target.is_none());
    }

    #[test]
    fn test_calculate_damage() {
        let arrow_tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);
        let magic_tower = Tower::new(1, (5, 5), TowerType::Magic, 0);

        let scout = Enemy::new(0, EnemyType::BasicScout, 1, (5, 5));
        let tank = Enemy::new(1, EnemyType::Tank, 1, (5, 5));

        // Arrow tower does normal damage
        assert_eq!(calculate_damage(&arrow_tower, &scout), 10);

        // Magic tower does normal damage to scout
        assert_eq!(calculate_damage(&magic_tower, &scout), 15);

        // Magic tower does bonus damage to tank
        assert_eq!(calculate_damage(&magic_tower, &tank), 30); // 15 * 2
    }

    #[test]
    fn test_apply_tower_effects() {
        let ice_tower = Tower::new(0, (5, 5), TowerType::Ice, 0);
        let mut enemy = Enemy::new(0, EnemyType::BasicScout, 1, (5, 5));

        assert_eq!(enemy.slow_multiplier, 1.0);

        apply_tower_effects(&ice_tower, &mut enemy);

        assert_eq!(enemy.slow_multiplier, 0.7);
    }

    #[test]
    fn test_update_enemy_position() {
        let path = vec![(0, 0), (5, 0), (5, 5), (10, 5)];
        let mut enemy = Enemy::new(0, EnemyType::BasicScout, 1, (0, 0));
        enemy.speed = 1.0; // 1 tile per second

        // Move for 1 second (1,000,000 microseconds)
        update_enemy_position(&mut enemy, &path, 1_000_000);

        // Should have moved approximately 1 tile
        assert!(enemy.position.0 > 0.0);
    }

    #[test]
    fn test_update_enemy_position_reaching_waypoint() {
        let path = vec![(0, 0), (1, 0), (2, 0)];
        let mut enemy = Enemy::new(0, EnemyType::BasicScout, 1, (0, 0));
        enemy.speed = 2.0; // 2 tiles per second

        // Move for 1 second
        update_enemy_position(&mut enemy, &path, 1_000_000);

        // Should have reached second waypoint (index 2)
        assert_eq!(enemy.path_index, 2);
    }

    #[test]
    fn test_find_chain_targets() {
        let tower = Tower::new(0, (5, 5), TowerType::Lightning, 0);

        let primary = Enemy::new(0, EnemyType::BasicScout, 1, (5, 5));

        let enemies = vec![
            Enemy::new(0, EnemyType::BasicScout, 1, (5, 5)), // Primary (should be excluded)
            Enemy::new(1, EnemyType::BasicScout, 1, (6, 6)), // In range
            Enemy::new(2, EnemyType::BasicScout, 1, (7, 7)), // In range
            Enemy::new(3, EnemyType::BasicScout, 1, (20, 20)), // Out of range
        ];

        let targets = find_chain_targets(&tower, &primary, &enemies, 2);

        assert_eq!(targets.len(), 2);
        assert!(targets.iter().all(|e| e.id != primary.id));
    }

    #[test]
    fn test_find_aoe_targets() {
        let center = (5.0, 5.0);
        let radius = 2.0;

        let enemies = vec![
            Enemy::new(0, EnemyType::BasicScout, 1, (5, 5)), // At center
            Enemy::new(1, EnemyType::BasicScout, 1, (6, 6)), // Within radius
            Enemy::new(2, EnemyType::BasicScout, 1, (10, 10)), // Out of radius
        ];

        let targets = find_aoe_targets(center, radius, &enemies);

        assert_eq!(targets.len(), 2);
        assert!(targets.iter().any(|e| e.id == 0));
        assert!(targets.iter().any(|e| e.id == 1));
    }
}
