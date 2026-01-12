use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Position {
    pub x: u8,
    pub y: u8,
}

impl Position {
    pub fn new(x: u8, y: u8) -> Self {
        Self { x, y }
    }

    pub fn from_tuple(pos: (u8, u8)) -> Self {
        Self { x: pos.0, y: pos.1 }
    }

    pub fn to_tuple(&self) -> (u8, u8) {
        (self.x, self.y)
    }

    pub fn manhattan_distance(&self, other: &Position) -> u32 {
        let dx = if self.x > other.x {
            self.x - other.x
        } else {
            other.x - self.x
        };
        let dy = if self.y > other.y {
            self.y - other.y
        } else {
            other.y - self.y
        };
        (dx as u32) + (dy as u32)
    }

    pub fn neighbors(&self, width: u8, height: u8) -> Vec<Position> {
        let mut neighbors = Vec::new();

        // Up
        if self.y > 0 {
            neighbors.push(Position::new(self.x, self.y - 1));
        }
        // Down
        if self.y < height - 1 {
            neighbors.push(Position::new(self.x, self.y + 1));
        }
        // Left
        if self.x > 0 {
            neighbors.push(Position::new(self.x - 1, self.y));
        }
        // Right
        if self.x < width - 1 {
            neighbors.push(Position::new(self.x + 1, self.y));
        }

        neighbors
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct Node {
    position: Position,
    f_score: u32, // g_score + heuristic
    g_score: u32, // cost from start
}

impl Ord for Node {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Reverse ordering for min-heap behavior
        other.f_score.cmp(&self.f_score)
    }
}

impl PartialOrd for Node {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// A* pathfinding algorithm
pub fn find_path(
    start: Position,
    goal: Position,
    width: u8,
    height: u8,
    blocked: &HashSet<Position>,
) -> Option<Vec<Position>> {
    let mut open_set = BinaryHeap::new();
    let mut came_from: HashMap<Position, Position> = HashMap::new();
    let mut g_scores: HashMap<Position, u32> = HashMap::new();

    g_scores.insert(start, 0);
    open_set.push(Node {
        position: start,
        f_score: start.manhattan_distance(&goal),
        g_score: 0,
    });

    while let Some(current_node) = open_set.pop() {
        let current = current_node.position;

        if current == goal {
            return Some(reconstruct_path(&came_from, current));
        }

        let current_g_score = *g_scores.get(&current).unwrap_or(&u32::MAX);

        for neighbor in current.neighbors(width, height) {
            // Skip blocked positions
            if blocked.contains(&neighbor) {
                continue;
            }

            let tentative_g_score = current_g_score.saturating_add(1);
            let neighbor_g_score = *g_scores.get(&neighbor).unwrap_or(&u32::MAX);

            if tentative_g_score < neighbor_g_score {
                came_from.insert(neighbor, current);
                g_scores.insert(neighbor, tentative_g_score);

                let f_score = tentative_g_score + neighbor.manhattan_distance(&goal);
                open_set.push(Node {
                    position: neighbor,
                    f_score,
                    g_score: tentative_g_score,
                });
            }
        }
    }

    None // No path found
}

fn reconstruct_path(came_from: &HashMap<Position, Position>, mut current: Position) -> Vec<Position> {
    let mut path = vec![current];

    while let Some(&prev) = came_from.get(&current) {
        path.push(prev);
        current = prev;
    }

    path.reverse();
    path
}

/// Check if placing a tower at a position would block the path
pub fn would_block_path(
    tower_position: Position,
    start: Position,
    goal: Position,
    width: u8,
    height: u8,
    existing_blocked: &HashSet<Position>,
) -> bool {
    let mut blocked = existing_blocked.clone();
    blocked.insert(tower_position);

    find_path(start, goal, width, height, &blocked).is_none()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_position_manhattan_distance() {
        let p1 = Position::new(0, 0);
        let p2 = Position::new(3, 4);

        assert_eq!(p1.manhattan_distance(&p2), 7); // 3 + 4
    }

    #[test]
    fn test_position_neighbors() {
        let pos = Position::new(5, 5);
        let neighbors = pos.neighbors(10, 10);

        assert_eq!(neighbors.len(), 4);
        assert!(neighbors.contains(&Position::new(5, 4))); // Up
        assert!(neighbors.contains(&Position::new(5, 6))); // Down
        assert!(neighbors.contains(&Position::new(4, 5))); // Left
        assert!(neighbors.contains(&Position::new(6, 5))); // Right
    }

    #[test]
    fn test_position_neighbors_corner() {
        let pos = Position::new(0, 0);
        let neighbors = pos.neighbors(10, 10);

        // Corner position should only have 2 neighbors
        assert_eq!(neighbors.len(), 2);
        assert!(neighbors.contains(&Position::new(1, 0))); // Right
        assert!(neighbors.contains(&Position::new(0, 1))); // Down
    }

    #[test]
    fn test_find_path_straight_line() {
        let start = Position::new(0, 0);
        let goal = Position::new(5, 0);
        let blocked = HashSet::new();

        let path = find_path(start, goal, 10, 10, &blocked);

        assert!(path.is_some());
        let path = path.unwrap();
        assert_eq!(path.len(), 6); // 0,0 -> 1,0 -> 2,0 -> 3,0 -> 4,0 -> 5,0
        assert_eq!(path[0], start);
        assert_eq!(path[path.len() - 1], goal);
    }

    #[test]
    fn test_find_path_with_obstacle() {
        let start = Position::new(0, 0);
        let goal = Position::new(2, 0);

        let mut blocked = HashSet::new();
        blocked.insert(Position::new(1, 0)); // Block direct path

        let path = find_path(start, goal, 10, 10, &blocked);

        assert!(path.is_some());
        let path = path.unwrap();

        // Path should go around the obstacle
        assert!(!path.contains(&Position::new(1, 0)));
        assert_eq!(path[0], start);
        assert_eq!(path[path.len() - 1], goal);
    }

    #[test]
    fn test_find_path_no_path() {
        let start = Position::new(0, 0);
        let goal = Position::new(2, 0);

        let mut blocked = HashSet::new();
        // Create a wall blocking all paths
        blocked.insert(Position::new(1, 0));
        for y in 0..10 {
            blocked.insert(Position::new(1, y));
        }

        let path = find_path(start, goal, 10, 10, &blocked);

        assert!(path.is_none());
    }

    #[test]
    fn test_would_block_path() {
        let start = Position::new(0, 5);
        let goal = Position::new(9, 5);
        let blocked = HashSet::new();

        // Placing a tower at (5, 5) should not block the path
        // (enemies can go around)
        let would_block = would_block_path(
            Position::new(5, 5),
            start,
            goal,
            10,
            10,
            &blocked,
        );

        assert!(!would_block);
    }

    #[test]
    fn test_would_block_path_blocks() {
        let start = Position::new(0, 0);
        let goal = Position::new(2, 0);

        let mut blocked = HashSet::new();
        // Create walls above and below
        for x in 0..10 {
            if x != 1 {
                blocked.insert(Position::new(x, 1));
            }
        }
        blocked.insert(Position::new(1, 1)); // This will complete the wall

        // There's only one path through (1, 0)
        // Blocking it should return true
        let mut test_blocked = HashSet::new();
        for y in 1..10 {
            test_blocked.insert(Position::new(1, y));
        }

        let would_block = would_block_path(
            Position::new(1, 0),
            start,
            goal,
            10,
            10,
            &test_blocked,
        );

        assert!(would_block);
    }

    #[test]
    fn test_complex_path() {
        let start = Position::new(0, 0);
        let goal = Position::new(9, 9);

        let mut blocked = HashSet::new();
        // Create some obstacles
        for i in 2..7 {
            blocked.insert(Position::new(i, 5));
            blocked.insert(Position::new(5, i));
        }

        let path = find_path(start, goal, 10, 10, &blocked);

        assert!(path.is_some());
        let path = path.unwrap();

        // Verify path doesn't go through obstacles
        for pos in &path {
            assert!(!blocked.contains(pos));
        }

        assert_eq!(path[0], start);
        assert_eq!(path[path.len() - 1], goal);
    }
}
