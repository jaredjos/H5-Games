export const BOARD_COLS = 20;
export const BOARD_ROWS = 18;
export const CELL_SIZE = 1.05;
export const LIFE_OPTIONS = [1, 3, 5];
export const DEFAULT_LIVES = 3;

export const DIRECTIONS = {
  up: { x: 0, z: -1 },
  down: { x: 0, z: 1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
};

export const KEY_DIRECTIONS = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

export const INITIAL_SNAKE = [
  { x: 3, z: 2 },
  { x: 2, z: 2 },
  { x: 1, z: 2 },
  { x: 0, z: 2 },
  { x: -1, z: 2 },
  { x: -2, z: 2 },
  { x: -3, z: 2 },
  { x: -4, z: 2 },
  { x: -5, z: 2 },
  { x: -5, z: 1 },
  { x: -5, z: 0 },
  { x: -5, z: -1 },
  { x: -4, z: -1 },
  { x: -3, z: -1 },
  { x: -2, z: -1 },
];

export const INITIAL_FOOD = { x: 4, z: -2 };

export const POWER_UPS = {
  aegis: {
    label: "AEGIS",
    durationMs: 12000,
    color: "#ffc84c",
  },
  fang: {
    label: "FANG",
    durationMs: 8500,
    color: "#ff6b48",
  },
  phase: {
    label: "PHASE",
    durationMs: 7500,
    color: "#8b7cff",
  },
};

export const LEVELS = [
  {
    number: 1,
    name: "AWAKENING",
    target: 3,
    tickMs: 155,
    enemyMoveEvery: 4,
    obstacles: [],
    hunters: [],
  },
  {
    number: 2,
    name: "FRACTURE",
    target: 4,
    tickMs: 144,
    enemyMoveEvery: 4,
    obstacles: [
      { x: -6, z: -5 }, { x: -1, z: -5 }, { x: 5, z: -5 },
      { x: -6, z: 6 }, { x: -1, z: 6 }, { x: 5, z: 6 },
    ],
    hunters: [],
  },
  {
    number: 3,
    name: "THE HUNT",
    target: 5,
    tickMs: 132,
    enemyMoveEvery: 3,
    obstacles: [
      { x: -7, z: -5 }, { x: -2, z: -5 }, { x: 3, z: -5 },
      { x: 7, z: -2 }, { x: 7, z: 4 }, { x: -7, z: 5 },
      { x: -2, z: 5 }, { x: 3, z: 5 }, { x: 0, z: -2 },
    ],
    hunters: [{ x: 8, z: -7 }],
  },
  {
    number: 4,
    name: "ONSLAUGHT",
    target: 6,
    tickMs: 118,
    enemyMoveEvery: 2,
    obstacles: [
      { x: -7, z: -6 }, { x: -7, z: -3 }, { x: -7, z: 1 }, { x: -7, z: 5 },
      { x: 7, z: -5 }, { x: 7, z: -1 }, { x: 7, z: 3 }, { x: 7, z: 6 },
      { x: -2, z: -6 }, { x: 3, z: 6 }, { x: 1, z: -2 }, { x: 5, z: 0 },
    ],
    hunters: [{ x: -9, z: 7 }, { x: 8, z: -7 }],
  },
  {
    number: 5,
    name: "APEX",
    target: 7,
    tickMs: 104,
    enemyMoveEvery: 2,
    obstacles: [
      { x: -8, z: -6 }, { x: -4, z: -6 }, { x: 1, z: -6 }, { x: 6, z: -6 },
      { x: -7, z: -2 }, { x: -2, z: -2 }, { x: 3, z: -2 }, { x: 7, z: 0 },
      { x: -8, z: 5 }, { x: -3, z: 5 }, { x: 2, z: 5 }, { x: 7, z: 5 },
      { x: -8, z: 1 }, { x: 0, z: 7 }, { x: 6, z: 7 },
    ],
    hunters: [{ x: -9, z: -8 }, { x: 8, z: -7 }, { x: 8, z: 7 }],
  },
  {
    number: 6,
    name: "AFTERSHOCK",
    target: 7,
    tickMs: 100,
    enemyMoveEvery: 2,
    obstacles: [
      { x: -8, z: -7 }, { x: -4, z: -7 }, { x: 0, z: -7 }, { x: 4, z: -7 }, { x: 8, z: -7 },
      { x: -8, z: 7 }, { x: -4, z: 7 }, { x: 0, z: 7 }, { x: 4, z: 7 }, { x: 8, z: 7 },
      { x: -8, z: -4 }, { x: -8, z: 0 }, { x: -8, z: 4 },
      { x: 8, z: -4 }, { x: 8, z: 0 }, { x: 8, z: 4 },
      { x: -1, z: -4 }, { x: 4, z: 4 },
    ],
    hunters: [{ x: -9, z: -8 }, { x: 9, z: -8 }, { x: 9, z: 8 }],
  },
  {
    number: 7,
    name: "CROSSFIRE",
    target: 8,
    tickMs: 96,
    enemyMoveEvery: 2,
    obstacles: [
      { x: -7, z: -7 }, { x: -7, z: -4 }, { x: -7, z: -1 }, { x: -7, z: 3 }, { x: -7, z: 6 },
      { x: 7, z: -7 }, { x: 7, z: -4 }, { x: 7, z: -1 }, { x: 7, z: 3 }, { x: 7, z: 6 },
      { x: -5, z: -6 }, { x: -1, z: -6 }, { x: 3, z: -6 },
      { x: -5, z: 6 }, { x: -1, z: 6 }, { x: 3, z: 6 },
      { x: -2, z: -4 }, { x: 2, z: -4 }, { x: -2, z: 4 }, { x: 2, z: 4 },
    ],
    hunters: [{ x: -9, z: -8 }, { x: 9, z: -8 }, { x: 9, z: 8 }],
  },
  {
    number: 8,
    name: "NULL FIELD",
    target: 8,
    tickMs: 92,
    enemyMoveEvery: 2,
    obstacles: [
      { x: -8, z: -7 }, { x: -5, z: -6 }, { x: -2, z: -5 }, { x: 1, z: -4 }, { x: 6, z: -3 }, { x: 8, z: -1 },
      { x: -8, z: 6 }, { x: -5, z: 5 }, { x: -2, z: 4 }, { x: 1, z: 3 }, { x: 6, z: 2 }, { x: 8, z: 0 },
      { x: 8, z: -7 }, { x: 5, z: -6 }, { x: 2, z: -5 }, { x: -1, z: -4 }, { x: -6, z: -3 }, { x: -8, z: -1 },
      { x: 8, z: 6 }, { x: 5, z: 5 }, { x: 2, z: 4 }, { x: -1, z: 3 }, { x: -6, z: 2 }, { x: -8, z: 0 },
    ],
    hunters: [{ x: -9, z: -8 }, { x: 9, z: -8 }, { x: -9, z: 8 }, { x: 9, z: 8 }],
  },
  {
    number: 9,
    name: "LAST LIGHT",
    target: 9,
    tickMs: 88,
    enemyMoveEvery: 1,
    obstacles: [
      { x: -8, z: -7 }, { x: -7, z: -7 }, { x: -4, z: -7 }, { x: -3, z: -7 }, { x: 0, z: -7 },
      { x: 1, z: -7 }, { x: 4, z: -7 }, { x: 5, z: -7 }, { x: 8, z: -7 },
      { x: -8, z: -3 }, { x: -5, z: -3 }, { x: -2, z: -3 }, { x: 1, z: -3 }, { x: 6, z: -3 }, { x: 8, z: -3 },
      { x: -8, z: 4 }, { x: -6, z: 4 }, { x: -3, z: 4 }, { x: 0, z: 4 }, { x: 3, z: 4 }, { x: 6, z: 4 }, { x: 8, z: 4 },
      { x: -8, z: 7 }, { x: -5, z: 7 }, { x: -2, z: 7 }, { x: 1, z: 7 }, { x: 4, z: 7 }, { x: 7, z: 7 },
    ],
    hunters: [{ x: -9, z: -8 }, { x: 9, z: -8 }, { x: -9, z: 8 }, { x: 9, z: 8 }],
  },
  {
    number: 10,
    name: "SINGULARITY",
    target: 10,
    tickMs: 84,
    enemyMoveEvery: 1,
    obstacles: [
      { x: -8, z: -7 }, { x: -6, z: -7 }, { x: -4, z: -7 }, { x: -2, z: -7 }, { x: 0, z: -7 },
      { x: 2, z: -7 }, { x: 4, z: -7 }, { x: 6, z: -7 }, { x: 8, z: -7 },
      { x: -8, z: 7 }, { x: -6, z: 7 }, { x: -4, z: 7 }, { x: -2, z: 7 }, { x: 0, z: 7 },
      { x: 2, z: 7 }, { x: 4, z: 7 }, { x: 6, z: 7 }, { x: 8, z: 7 },
      { x: -8, z: -5 }, { x: -8, z: -3 }, { x: -8, z: -1 }, { x: -8, z: 1 }, { x: -8, z: 3 }, { x: -8, z: 5 },
      { x: 8, z: -5 }, { x: 8, z: -3 }, { x: 8, z: -1 }, { x: 8, z: 1 }, { x: 8, z: 3 }, { x: 8, z: 5 },
    ],
    hunters: [{ x: -9, z: -8 }, { x: 9, z: -8 }, { x: -9, z: 8 }, { x: 9, z: 8 }, { x: 0, z: -8 }],
  },
];

export function cellToWorld(cell) {
  return {
    x: (cell.x + 0.5) * CELL_SIZE,
    z: (cell.z + 0.5) * CELL_SIZE,
  };
}
