/**
 * Mock GraphQL Backend for Tower Defense
 * Provides multiplayer game state synchronization for testing
 */

const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const bodyParser = require('body-parser');

// Game state storage
const gameStates = new Map();
const playerStates = new Map();

// GraphQL Schema
const typeDefs = `#graphql
  type GameState {
    gold: Int!
    health: Int!
    wave: Int!
    status: String!
    towers: [Tower!]!
    enemies: [Enemy!]!
  }

  type Tower {
    id: String!
    towerType: String!
    position: Position!
    level: Int!
  }

  type Enemy {
    id: String!
    enemyType: String!
    position: Position!
    health: Int!
    maxHealth: Int!
  }

  type Position {
    x: Int!
    y: Int!
  }

  type Query {
    gameState(chainId: String!): GameState
  }

  type Mutation {
    placeTower(chainId: String!, x: Int!, y: Int!, towerType: String!): Tower
    startWave(chainId: String!): Boolean
    updateGameState(chainId: String!, gold: Int, health: Int, wave: Int, status: String): Boolean
  }

  type Subscription {
    gameStateChanged(chainId: String!): GameState
  }
`;

// Resolvers
const resolvers = {
  Query: {
    gameState: (_, { chainId }) => {
      if (!gameStates.has(chainId)) {
        gameStates.set(chainId, {
          gold: 500,
          health: 20,
          wave: 0,
          status: 'Preparing',
          towers: [],
          enemies: []
        });
      }
      return gameStates.get(chainId);
    }
  },

  Mutation: {
    placeTower: (_, { chainId, x, y, towerType }) => {
      const state = gameStates.get(chainId) || {
        gold: 500,
        health: 20,
        wave: 0,
        status: 'Preparing',
        towers: [],
        enemies: []
      };

      const tower = {
        id: `tower_${Date.now()}_${Math.random()}`,
        towerType,
        position: { x, y },
        level: 1
      };

      state.towers.push(tower);
      gameStates.set(chainId, state);

      return tower;
    },

    startWave: (_, { chainId }) => {
      const state = gameStates.get(chainId);
      if (state) {
        state.wave += 1;
        state.status = `Wave ${state.wave}`;
        gameStates.set(chainId, state);
      }
      return true;
    },

    updateGameState: (_, { chainId, gold, health, wave, status }) => {
      const state = gameStates.get(chainId) || {
        gold: 500,
        health: 20,
        wave: 0,
        status: 'Preparing',
        towers: [],
        enemies: []
      };

      if (gold !== null && gold !== undefined) state.gold = gold;
      if (health !== null && health !== undefined) state.health = health;
      if (wave !== null && wave !== undefined) state.wave = wave;
      if (status !== null && status !== undefined) state.status = status;

      gameStates.set(chainId, state);
      return true;
    }
  }
};

async function startServer() {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  app.use(
    cors(),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req }) => ({ token: req.headers.token }),
    })
  );

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', games: gameStates.size });
  });

  // Linera-style endpoint
  app.post('/chains/:chainId/applications/:appId', (req, res) => {
    res.json({ data: { gameState: gameStates.get(req.params.chainId) || null } });
  });

  const PORT = 8081;
  app.listen(PORT, () => {
    console.log(`🚀 Mock GraphQL server running at http://localhost:${PORT}/graphql`);
    console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  });
}

startServer().catch(console.error);
