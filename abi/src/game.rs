use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum GameStatus {
    #[default]
    Lobby,
    Active,
    Victory,
    Defeat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    pub grid_width: u8,
    pub grid_height: u8,
    pub starting_gold: u64,
    pub base_health: u32,
    pub max_towers: usize,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            grid_width: 20,
            grid_height: 20,
            starting_gold: 500,
            base_health: 20,
            max_towers: 50,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Grid {
    pub width: u8,
    pub height: u8,
    pub path: Vec<(u8, u8)>,
    pub spawn_point: (u8, u8),
    pub base_point: (u8, u8),
}

impl Grid {
    pub fn new() -> Self {
        Self {
            width: 20,
            height: 20,
            spawn_point: (0, 10),
            base_point: (19, 14),
            path: Self::generate_default_path(),
        }
    }

    fn generate_default_path() -> Vec<(u8, u8)> {
        let mut path = Vec::new();

        // Horizontal segment from spawn
        for x in 0..8 {
            path.push((x, 10));
        }

        // Vertical segment going up
        for y in (5..10).rev() {
            path.push((7, y));
        }

        // Horizontal segment going right
        for x in 7..15 {
            path.push((x, 5));
        }

        // Vertical segment going down
        for y in 5..15 {
            path.push((14, y));
        }

        // Final horizontal segment to base
        for x in 14..20 {
            path.push((x, 14));
        }

        path
    }

    pub fn is_on_path(&self, pos: (u8, u8)) -> bool {
        self.path.contains(&pos)
    }

    pub fn is_valid_position(&self, pos: (u8, u8)) -> bool {
        pos.0 < self.width && pos.1 < self.height
    }
}

impl Default for Grid {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_grid() {
        let grid = Grid::new();
        assert_eq!(grid.width, 20);
        assert_eq!(grid.height, 20);
        assert_eq!(grid.spawn_point, (0, 10));
        assert_eq!(grid.base_point, (19, 14));
        assert!(!grid.path.is_empty());
    }

    #[test]
    fn test_is_on_path() {
        let grid = Grid::new();
        assert!(grid.is_on_path((0, 10))); // Spawn point
        assert!(grid.is_on_path((7, 5)));  // Mid path
        assert!(!grid.is_on_path((0, 0))); // Not on path
    }

    #[test]
    fn test_is_valid_position() {
        let grid = Grid::new();
        assert!(grid.is_valid_position((0, 0)));
        assert!(grid.is_valid_position((19, 19)));
        assert!(!grid.is_valid_position((20, 20))); // Out of bounds
    }

    #[test]
    fn test_game_config_default() {
        let config = GameConfig::default();
        assert_eq!(config.grid_width, 20);
        assert_eq!(config.starting_gold, 500);
        assert_eq!(config.base_health, 20);
    }
}
