//! Integration tests for Tower Defense game logic
//! Run with: cargo test --test game_logic_test

use tower_defense_abi::*;

#[test]
fn test_tower_placement_on_grid() {
    let grid = Grid::new();

    // Verify grid dimensions
    assert_eq!(grid.width, 20);
    assert_eq!(grid.height, 20);

    // Test valid position
    assert!(grid.is_valid_position((0, 0)));
    assert!(grid.is_valid_position((19, 19)));

    // Test invalid position
    assert!(!grid.is_valid_position((20, 0)));
    assert!(!grid.is_valid_position((0, 20)));
}

#[test]
fn test_tower_cannot_be_placed_on_path() {
    let grid = Grid::new();

    // Spawn point should be on path
    assert!(grid.is_on_path((0, 10)));

    // Not all positions are on path
    assert!(!grid.is_on_path((0, 0)));
}

#[test]
fn test_tower_upgrade_progression() {
    let mut tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);

    // Initial stats
    assert_eq!(tower.level, 1);
    assert_eq!(tower.stats.damage, 10);

    // Upgrade to level 2
    assert!(tower.upgrade().is_ok());
    assert_eq!(tower.level, 2);
    assert!(tower.stats.damage > 10);

    // Upgrade to level 3
    assert!(tower.upgrade().is_ok());
    assert_eq!(tower.level, 3);

    // Cannot upgrade past max level
    assert!(tower.upgrade().is_err());
}

#[test]
fn test_enemy_takes_damage() {
    let mut enemy = Enemy::new(0, EnemyType::BasicScout, 1, (0, 10));

    let initial_health = enemy.health;
    assert!(enemy.is_alive());

    // Take non-lethal damage
    let killed = enemy.take_damage(10);
    assert!(!killed);
    assert!(enemy.is_alive());
    assert!(enemy.health < initial_health);

    // Take lethal damage
    let killed = enemy.take_damage(1000);
    assert!(killed);
    assert!(!enemy.is_alive());
}

#[test]
fn test_wave_generation() {
    let enemies = wave::generate_wave(1, (0, 10));

    // Wave 1 should have enemies
    assert!(!enemies.is_empty());

    // All enemies should spawn at spawn point
    for enemy in &enemies {
        assert_eq!(enemy.position, (0.0, 10.0));
    }
}

#[test]
fn test_boss_wave() {
    let enemies = wave::generate_wave(10, (0, 10));

    // Wave 10 should have a boss
    let has_boss = enemies.iter().any(|e| e.enemy_type == EnemyType::Boss);
    assert!(has_boss);
}

#[test]
fn test_economy_rewards() {
    // Test kill rewards
    let wave1_reward = economy::calculate_kill_reward(EnemyType::BasicScout, 1);
    let wave10_reward = economy::calculate_kill_reward(EnemyType::BasicScout, 10);

    // Later waves give more gold
    assert!(wave10_reward > wave1_reward);

    // Boss gives much more reward
    let boss_reward = economy::calculate_kill_reward(EnemyType::Boss, 1);
    assert!(boss_reward > wave1_reward);
}

#[test]
fn test_tower_sell_value() {
    let config = economy::EconomyConfig::default();

    let buy_cost = TowerType::Arrow.cost();
    let sell_value = economy::calculate_sell_value(TowerType::Arrow, 1, &config);

    // Sell value should be less than buy cost
    assert!(sell_value < buy_cost);

    // Sell value should be about 70%
    assert_eq!(sell_value, 70);
}

#[test]
fn test_pathfinding() {
    use std::collections::HashSet;

    let start = pathfinding::Position::new(0, 0);
    let goal = pathfinding::Position::new(5, 5);
    let blocked = HashSet::new();

    let path = pathfinding::find_path(start, goal, 20, 20, &blocked);

    assert!(path.is_some());
    let path = path.unwrap();
    assert_eq!(path[0], start);
    assert_eq!(path[path.len() - 1], goal);
}

#[test]
fn test_combat_targeting() {
    use combat::*;

    let tower = Tower::new(0, (5, 5), TowerType::Arrow, 0);

    // Create enemies at different positions
    let enemies = vec![
        Enemy::new(0, EnemyType::BasicScout, 1, (6, 5)), // In range
        {
            let mut e = Enemy::new(1, EnemyType::BasicScout, 1, (7, 5));
            e.path_index = 5; // Further along path
            e
        },
        {
            let mut e = Enemy::new(2, EnemyType::BasicScout, 1, (20, 20));
            e.path_index = 10; // Out of range
            e
        },
    ];

    let target = find_target(&tower, &enemies);

    // Should target enemy furthest along path BUT in range
    assert!(target.is_some());
    assert_eq!(target.unwrap().id, 1);
}
