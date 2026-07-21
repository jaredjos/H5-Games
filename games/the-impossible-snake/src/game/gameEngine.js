import {
  BOARD_COLS,
  BOARD_ROWS,
  DEFAULT_LIVES,
  DIRECTIONS,
  INITIAL_FOOD,
  INITIAL_SNAKE,
  LIFE_OPTIONS,
  LEVELS,
  POWER_UPS,
} from "./constants";

const POWER_SEQUENCE = ["aegis", "phase", "fang"];
const HUNTER_DIRECTIONS = [DIRECTIONS.up, DIRECTIONS.right, DIRECTIONS.down, DIRECTIONS.left];
const QA_READY_DELAY = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get("qaDelay") === "1"
  ? 8000
  : 650;

function sameCell(a, b) {
  return a.x === b.x && a.z === b.z;
}

function cellKey({ x, z }) {
  return `${x}:${z}`;
}

function isOpposite(a, b) {
  return a.x + b.x === 0 && a.z + b.z === 0;
}

function isInBounds(cell) {
  const halfCols = BOARD_COLS / 2;
  const halfRows = BOARD_ROWS / 2;
  return cell.x >= -halfCols
    && cell.x < halfCols
    && cell.z >= -halfRows
    && cell.z < halfRows;
}

function wrapCell(cell) {
  const halfCols = BOARD_COLS / 2;
  const halfRows = BOARD_ROWS / 2;
  return {
    x: cell.x < -halfCols ? halfCols - 1 : cell.x >= halfCols ? -halfCols : cell.x,
    z: cell.z < -halfRows ? halfRows - 1 : cell.z >= halfRows ? -halfRows : cell.z,
  };
}

function findOpenCell({ snake, obstacles, enemies, food, powerUp }) {
  const occupied = new Set([
    ...snake.map(cellKey),
    ...obstacles.map(cellKey),
    ...enemies.map(cellKey),
  ]);
  if (food) occupied.add(cellKey(food));
  if (powerUp) occupied.add(cellKey(powerUp.cell));

  const open = [];
  const halfCols = BOARD_COLS / 2;
  const halfRows = BOARD_ROWS / 2;
  for (let z = -halfRows; z < halfRows; z += 1) {
    for (let x = -halfCols; x < halfCols; x += 1) {
      if (!occupied.has(`${x}:${z}`)) open.push({ x, z });
    }
  }

  return open[Math.floor(Math.random() * open.length)] ?? { ...INITIAL_FOOD };
}

function createHunters(config) {
  return config.hunters.map((cell, index) => ({
    id: `hunter-${config.number}-${index}`,
    ...cell,
    direction: DIRECTIONS.left,
    intent: null,
  }));
}

function normalizeLives(value) {
  return LIFE_OPTIONS.includes(value) ? value : DEFAULT_LIVES;
}

function createLevelState(levelIndex, score, best, eventId, status = "playing", run = {}) {
  const config = LEVELS[levelIndex];
  const obstacles = config.obstacles.map((cell) => ({ ...cell }));
  const enemies = createHunters(config);
  const snake = INITIAL_SNAKE.map((cell) => ({ ...cell }));
  const maxLives = normalizeLives(run.maxLives);
  const food = isInBounds(INITIAL_FOOD)
    && !obstacles.some((cell) => sameCell(cell, INITIAL_FOOD))
    && !enemies.some((cell) => sameCell(cell, INITIAL_FOOD))
    ? { ...INITIAL_FOOD }
    : findOpenCell({ snake, obstacles, enemies, food: null, powerUp: null });

  return {
    snake,
    food,
    direction: DIRECTIONS.right,
    queuedDirection: DIRECTIONS.right,
    status,
    score,
    best,
    lives: run.lives ?? maxLives,
    maxLives,
    testMode: Boolean(run.testMode),
    rewardReviveUsed: Boolean(run.rewardReviveUsed),
    levelStartScore: run.levelStartScore ?? score,
    levelIndex,
    levelProgress: 0,
    obstacles,
    enemies,
    powerUp: null,
    activePower: null,
    entryDelayMs: run.entryDelayMs ?? (status === "ready" ? QA_READY_DELAY : 850),
    tick: 0,
    defeatCause: null,
    event: { id: eventId, type: status === "ready" ? "ready" : "levelstart" },
  };
}

export function createInitialState(best = 0, maxLives = DEFAULT_LIVES, testMode = false) {
  return createLevelState(0, 0, best, 0, "ready", { maxLives, testMode });
}

export function createPreviewState(
  levelIndex,
  best = 0,
  showcase = false,
  maxLives = DEFAULT_LIVES,
  testMode = false,
) {
  const safeLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  const state = createLevelState(safeLevelIndex, 0, best, 0, "ready", { maxLives, testMode });
  if (!showcase || safeLevelIndex < 2) return state;

  return {
    ...state,
    score: 450,
    levelStartScore: 450,
    levelProgress: Math.min(2, LEVELS[safeLevelIndex].target - 1),
    powerUp: { type: "fang", cell: { x: -8, z: 7 } },
    activePower: { type: "aegis", remainingMs: POWER_UPS.aegis.durationMs },
  };
}

function endRun(state, cause, eventId = state.event.id + 1) {
  const lives = state.testMode ? state.lives : Math.max(0, state.lives - 1);
  return {
    ...state,
    lives,
    status: state.testMode || lives > 0 ? "lifeLost" : "gameover",
    defeatCause: cause,
    event: { id: eventId, type: "crash", cause, lives },
  };
}

function spawnPowerUp(state, levelProgress, food) {
  if (state.levelIndex === 0 || state.powerUp || state.activePower || levelProgress % 2 !== 0) {
    return state.powerUp;
  }

  const type = POWER_SEQUENCE[(state.levelIndex + Math.floor(levelProgress / 2) - 1) % POWER_SEQUENCE.length];
  const cell = findOpenCell({ ...state, food, powerUp: null });
  return { type, cell };
}

function shortestPathDistance(start, target, blocked) {
  if (sameCell(start, target)) return 0;

  const queue = [{ ...start, distance: 0 }];
  const visited = new Set([cellKey(start)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const direction of HUNTER_DIRECTIONS) {
      const next = { x: current.x + direction.x, z: current.z + direction.z };
      const key = cellKey(next);
      if (!isInBounds(next) || blocked.has(key) || visited.has(key)) continue;
      if (sameCell(next, target)) return current.distance + 1;
      visited.add(key);
      queue.push({ ...next, distance: current.distance + 1 });
    }
  }

  return Number.POSITIVE_INFINITY;
}

function chooseHunterIntent(enemy, state, playerHead, reserved, snake) {
  const blocked = new Set(state.obstacles.map(cellKey));
  if (state.food) blocked.add(cellKey(state.food));
  if (state.powerUp) blocked.add(cellKey(state.powerUp.cell));
  snake.slice(1).forEach((cell) => blocked.add(cellKey(cell)));
  reserved.forEach((key) => blocked.add(key));
  blocked.delete(cellKey(enemy));
  blocked.delete(cellKey(playerHead));

  const candidates = HUNTER_DIRECTIONS.map((direction, index) => ({
    direction,
    index,
    x: enemy.x + direction.x,
    z: enemy.z + direction.z,
  })).filter((cell) => isInBounds(cell) && !blocked.has(cellKey(cell)));

  if (!candidates.length) return { ...enemy, intent: null };

  candidates.sort((a, b) => {
    const distanceA = shortestPathDistance(a, playerHead, blocked);
    const distanceB = shortestPathDistance(b, playerHead, blocked);
    if (distanceA !== distanceB) return distanceA - distanceB;
    const keepsHeadingA = sameCell(a.direction, enemy.direction) ? 0 : 1;
    const keepsHeadingB = sameCell(b.direction, enemy.direction) ? 0 : 1;
    if (keepsHeadingA !== keepsHeadingB) return keepsHeadingA - keepsHeadingB;
    return ((a.index + state.tick + enemy.id.length) % 4)
      - ((b.index + state.tick + enemy.id.length) % 4);
  });

  const next = candidates[0];
  return {
    ...enemy,
    direction: next.direction,
    intent: { x: next.x, z: next.z },
  };
}

function executeHunterIntent(enemy, state, snake, reserved) {
  if (!enemy.intent) return enemy;

  const blocked = new Set([
    ...state.obstacles.map(cellKey),
    ...snake.slice(1).map(cellKey),
    ...reserved,
  ]);
  if (state.food) blocked.add(cellKey(state.food));
  if (state.powerUp) blocked.add(cellKey(state.powerUp.cell));

  if (!isInBounds(enemy.intent) || blocked.has(cellKey(enemy.intent))) {
    return { ...enemy, intent: null };
  }

  return {
    ...enemy,
    x: enemy.intent.x,
    z: enemy.intent.z,
    intent: null,
  };
}

function moveHunters(state, snake, enemies, activePower, score, event) {
  const config = LEVELS[state.levelIndex];
  if (!enemies.length || (state.tick + 1) % config.enemyMoveEvery !== 0) {
    return { enemies, activePower, score, event, collision: null };
  }

  const moved = [];
  const reserved = new Set(enemies.map(cellKey));
  const reservedIntents = new Set();
  let nextPower = activePower;
  let nextScore = score;
  let nextEvent = event;

  for (let enemyIndex = 0; enemyIndex < enemies.length; enemyIndex += 1) {
    const enemy = enemies[enemyIndex];
    reserved.delete(cellKey(enemy));
    const nextEnemy = enemy.intent
      ? executeHunterIntent(enemy, state, snake, reserved)
      : chooseHunterIntent(
        enemy,
        state,
        snake[0],
        new Set([...reserved, ...reservedIntents]),
        snake,
      );
    const hitHead = sameCell(snake[0], nextEnemy);

    if (hitHead && nextPower?.type === "fang") {
      nextScore += 200;
      nextEvent = { id: nextEvent.id + 1, type: "hunter" };
      continue;
    }

    if (hitHead && nextPower?.type === "aegis") {
      nextPower = null;
      nextEvent = { id: nextEvent.id + 1, type: "shield" };
      continue;
    }

    if (hitHead) {
      return {
        enemies: [...moved, nextEnemy, ...enemies.slice(enemyIndex + 1)],
        activePower: nextPower,
        score: nextScore,
        event: nextEvent,
        collision: "hunter",
      };
    }

    moved.push(nextEnemy);
    reserved.add(cellKey(nextEnemy));
    if (nextEnemy.intent) {
      reservedIntents.add(cellKey(nextEnemy.intent));
      if (sameCell(nextEnemy.intent, snake[0])) {
        nextEvent = { id: nextEvent.id + 1, type: "warning" };
      }
    }
  }

  return { enemies: moved, activePower: nextPower, score: nextScore, event: nextEvent, collision: null };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case "STEER": {
      const nextDirection = DIRECTIONS[action.direction];
      if (!nextDirection || isOpposite(nextDirection, state.direction)) return state;
      if (["gameover", "lifeLost", "victory", "levelup"].includes(state.status)) return state;

      return {
        ...state,
        queuedDirection: nextDirection,
        status: state.status === "ready" ? "playing" : state.status,
        entryDelayMs: state.status === "ready" ? 0 : state.entryDelayMs,
      };
    }
    case "TOGGLE_PAUSE": {
      if (["gameover", "lifeLost", "victory", "levelup"].includes(state.status)) return state;
      if (state.status === "ready") return { ...state, status: "playing" };
      return { ...state, status: state.status === "paused" ? "playing" : "paused" };
    }
    case "ADVANCE_LEVEL": {
      if (state.status !== "levelup") return state;
      return createLevelState(
        Math.min(state.levelIndex + 1, LEVELS.length - 1),
        state.score,
        state.best,
        state.event.id + 1,
        "playing",
        {
          lives: state.lives,
          maxLives: state.maxLives,
          testMode: state.testMode,
          rewardReviveUsed: state.rewardReviveUsed,
          levelStartScore: state.score,
        },
      );
    }
    case "RETRY_LEVEL": {
      if (state.status !== "lifeLost") return state;
      return createLevelState(
        state.levelIndex,
        state.levelStartScore,
        state.best,
        state.event.id + 1,
        "playing",
        {
          lives: state.lives,
          maxLives: state.maxLives,
          testMode: state.testMode,
          rewardReviveUsed: state.rewardReviveUsed,
          levelStartScore: state.levelStartScore,
          entryDelayMs: 950,
        },
      );
    }
    case "REWARDED_REVIVE": {
      if (state.status !== "gameover" || state.rewardReviveUsed || state.testMode) return state;
      return createLevelState(
        state.levelIndex,
        state.levelStartScore,
        state.best,
        state.event.id + 1,
        "ready",
        {
          lives: 1,
          maxLives: state.maxLives,
          rewardReviveUsed: true,
          levelStartScore: state.levelStartScore,
        },
      );
    }
    case "SET_MAX_LIVES": {
      if (state.status !== "ready" || state.levelIndex !== 0 || state.testMode) return state;
      const maxLives = normalizeLives(action.maxLives);
      return { ...state, lives: maxLives, maxLives };
    }
    case "NEW_CAMPAIGN":
      return createInitialState(state.best, state.maxLives);
    case "TOGGLE_TEST_MODE": {
      if (state.testMode) return createInitialState(state.best, state.maxLives);
      return createLevelState(
        state.levelIndex,
        0,
        state.best,
        state.event.id + 1,
        "ready",
        {
          lives: state.maxLives,
          maxLives: state.maxLives,
          testMode: true,
          levelStartScore: 0,
        },
      );
    }
    case "SELECT_TEST_LEVEL": {
      if (!state.testMode || !Number.isInteger(action.levelIndex)) return state;
      const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, action.levelIndex));
      return createLevelState(
        levelIndex,
        0,
        state.best,
        state.event.id + 1,
        "ready",
        {
          lives: state.maxLives,
          maxLives: state.maxLives,
          testMode: true,
          levelStartScore: 0,
        },
      );
    }
    case "ACTIVATE_TEST_POWER": {
      if (!state.testMode || !POWER_UPS[action.power]) return state;
      return {
        ...state,
        powerUp: null,
        activePower: {
          type: action.power,
          remainingMs: POWER_UPS[action.power].durationMs,
        },
        event: { id: state.event.id + 1, type: "powerup", power: action.power },
      };
    }
    case "TICK": {
      if (state.status !== "playing") return state;

      const elapsedMs = action.elapsedMs ?? LEVELS[state.levelIndex].tickMs;
      if (state.entryDelayMs > 0) {
        return {
          ...state,
          entryDelayMs: Math.max(0, state.entryDelayMs - elapsedMs),
        };
      }

      let expiredPower = null;
      let activePower = state.activePower
        ? { ...state.activePower, remainingMs: state.activePower.remainingMs - elapsedMs }
        : null;
      if (activePower && activePower.remainingMs <= 0) {
        expiredPower = activePower.type;
        activePower = null;
      }

      const direction = state.queuedDirection;
      const head = state.snake[0];
      let nextHead = { x: head.x + direction.x, z: head.z + direction.z };
      const phaseActive = activePower?.type === "phase";

      if (!isInBounds(nextHead)) {
        if (!phaseActive) return endRun({ ...state, activePower }, "wall");
        nextHead = wrapCell(nextHead);
      }

      const ate = sameCell(nextHead, state.food);
      const collisionBody = ate ? state.snake : state.snake.slice(0, -1);
      if (collisionBody.some((cell) => sameCell(cell, nextHead))) {
        return endRun({ ...state, activePower }, "self");
      }

      let obstacles = state.obstacles;
      const obstacleIndex = obstacles.findIndex((cell) => sameCell(cell, nextHead));
      if (obstacleIndex >= 0 && !phaseActive) {
        if (activePower?.type !== "aegis") return endRun({ ...state, activePower }, "spire");
        obstacles = obstacles.filter((_, index) => index !== obstacleIndex);
        activePower = null;
      }

      let enemies = state.enemies;
      let score = state.score;
      let event = expiredPower
        ? { id: state.event.id + 1, type: "powerend", power: expiredPower }
        : state.event;
      const enemyIndex = enemies.findIndex((enemy) => sameCell(enemy, nextHead));
      if (enemyIndex >= 0) {
        if (activePower?.type === "fang") {
          enemies = enemies.filter((_, index) => index !== enemyIndex);
          score += 200;
          event = { id: event.id + 1, type: "hunter" };
        } else if (activePower?.type === "aegis") {
          enemies = enemies.filter((_, index) => index !== enemyIndex);
          activePower = null;
          event = { id: event.id + 1, type: "shield" };
        } else {
          return endRun({ ...state, activePower }, "hunter");
        }
      } else if (obstacleIndex >= 0 && !phaseActive) {
        event = { id: event.id + 1, type: "shield" };
      }

      const movedSnake = [nextHead, ...state.snake];
      if (!ate) movedSnake.pop();

      let levelProgress = state.levelProgress;
      let food = state.food;
      let powerUp = state.powerUp;
      if (ate) {
        levelProgress += 1;
        score += 100;
        event = { id: event.id + 1, type: "collect" };
      }

      const collectedPower = powerUp && sameCell(nextHead, powerUp.cell);
      if (collectedPower) {
        activePower = {
          type: powerUp.type,
          remainingMs: POWER_UPS[powerUp.type].durationMs,
        };
        powerUp = null;
        event = { id: event.id + 1, type: "powerup", power: activePower.type };
      }

      const config = LEVELS[state.levelIndex];
      if (ate && levelProgress >= config.target) {
        const victory = state.levelIndex === LEVELS.length - 1;
        return {
          ...state,
          snake: movedSnake,
          direction,
          score,
          best: Math.max(state.best, score),
          levelProgress,
          obstacles,
          enemies,
          powerUp: null,
          activePower: null,
          tick: state.tick + 1,
          status: victory ? "victory" : "levelup",
          event: { id: event.id + 1, type: victory ? "victory" : "levelup" },
        };
      }

      if (ate) {
        food = findOpenCell({ snake: movedSnake, obstacles, enemies, food: null, powerUp });
        powerUp = spawnPowerUp({
          ...state,
          snake: movedSnake,
          obstacles,
          enemies,
          powerUp,
          activePower,
        }, levelProgress, food);
      }

      const hunterResult = moveHunters(
        { ...state, obstacles, food, powerUp },
        movedSnake,
        enemies,
        activePower,
        score,
        event,
      );
      if (hunterResult.collision) {
        return endRun({
          ...state,
          snake: movedSnake,
          food,
          direction,
          obstacles,
          enemies: hunterResult.enemies,
          powerUp,
          activePower: hunterResult.activePower,
          score: hunterResult.score,
          best: Math.max(state.best, hunterResult.score),
          levelProgress,
          tick: state.tick + 1,
          event: hunterResult.event,
        }, hunterResult.collision, hunterResult.event.id + 1);
      }

      return {
        ...state,
        snake: movedSnake,
        food,
        direction,
        score: hunterResult.score,
        best: Math.max(state.best, hunterResult.score),
        levelProgress,
        obstacles,
        enemies: hunterResult.enemies,
        powerUp,
        activePower: hunterResult.activePower,
        tick: state.tick + 1,
        event: hunterResult.event,
      };
    }
    case "RESET":
      if (state.testMode) {
        return createLevelState(
          state.levelIndex,
          0,
          state.best,
          state.event.id + 1,
          "ready",
          {
            lives: state.maxLives,
            maxLives: state.maxLives,
            testMode: true,
            levelStartScore: 0,
          },
        );
      }
      return createInitialState(state.best, state.maxLives);
    default:
      return state;
  }
}

export function getTickDelay(state) {
  const config = LEVELS[state.levelIndex];
  const scorePressure = Math.floor(state.score / 600) * 3;
  return Math.max(72, config.tickMs - scorePressure);
}

export function getThreatLevel(state) {
  if (!state.enemies.length || state.status !== "playing") return 0;
  const head = state.snake[0];
  if (state.enemies.some((enemy) => enemy.intent && sameCell(enemy.intent, head))) return 1;
  const nearest = Math.min(...state.enemies.map(
    (enemy) => {
      const enemyDistance = Math.abs(enemy.x - head.x) + Math.abs(enemy.z - head.z);
      if (!enemy.intent) return enemyDistance;
      const intentDistance = Math.abs(enemy.intent.x - head.x) + Math.abs(enemy.intent.z - head.z);
      return Math.min(enemyDistance, intentDistance);
    },
  ));
  return Math.max(0, Math.min(1, (8 - nearest) / 7));
}
