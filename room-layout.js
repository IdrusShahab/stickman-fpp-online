const ROOM = {
  width: 150,
  depth: 150,
  height: 4.5
};

const MAZE_COLS = 15;
const MAZE_ROWS = 15;
const CELL_SIZE = 10;
const WALL_THICKNESS = 0.2;
const PLAYER_RADIUS = 0.35;
const MAZE_SEED = 0x1e0f0;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createMazeGrid(cols, rows, rand) {
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ n: true, e: true, s: true, w: true }))
  );

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  function carve(r, c) {
    visited[r][c] = true;
    const dirs = shuffle([
      { dr: -1, dc: 0, wall: 'n', opp: 's' },
      { dr: 0, dc: 1, wall: 'e', opp: 'w' },
      { dr: 1, dc: 0, wall: 's', opp: 'n' },
      { dr: 0, dc: -1, wall: 'w', opp: 'e' }
    ], rand);

    for (const { dr, dc, wall, opp } of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || visited[nr][nc]) continue;
      grid[r][c][wall] = false;
      grid[nr][nc][opp] = false;
      carve(nr, nc);
    }
  }

  carve(0, 0);

  const centerR = Math.floor(rows / 2);
  const centerC = Math.floor(cols / 2);
  for (let r = centerR - 1; r <= centerR + 1; r++) {
    for (let c = centerC - 1; c <= centerC + 1; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      grid[r][c].n = false;
      grid[r][c].e = false;
      grid[r][c].s = false;
      grid[r][c].w = false;
      if (r > 0) grid[r - 1][c].s = false;
      if (c > 0) grid[r][c - 1].e = false;
      if (r < rows - 1) grid[r + 1][c].n = false;
      if (c < cols - 1) grid[r][c + 1].w = false;
    }
  }

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (rand() < 0.08) {
        const pick = Math.floor(rand() * 4);
        const keys = ['n', 'e', 's', 'w'];
        const key = keys[pick];
        grid[r][c][key] = false;
        if (key === 'n' && r > 0) grid[r - 1][c].s = false;
        if (key === 's' && r < rows - 1) grid[r + 1][c].n = false;
        if (key === 'w' && c > 0) grid[r][c - 1].e = false;
        if (key === 'e' && c < cols - 1) grid[r][c + 1].w = false;
      }
    }
  }

  return grid;
}

function buildPartitions(grid, cols, rows, cellSize, mapW, mapD) {
  const partitions = [];
  const hw = mapW / 2;
  const hd = mapD / 2;
  const t = WALL_THICKNESS;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = -hw + c * cellSize + cellSize / 2;
      const cz = -hd + r * cellSize + cellSize / 2;
      const cell = grid[r][c];

      if (cell.n) {
        partitions.push({ x: cx, z: cz - cellSize / 2, w: cellSize, d: t });
      }
      if (cell.w) {
        partitions.push({ x: cx - cellSize / 2, z: cz, w: t, d: cellSize });
      }
      if (r === rows - 1 && cell.s) {
        partitions.push({ x: cx, z: cz + cellSize / 2, w: cellSize, d: t });
      }
      if (c === cols - 1 && cell.e) {
        partitions.push({ x: cx + cellSize / 2, z: cz, w: t, d: cellSize });
      }
    }
  }

  return partitions;
}

const mazeGrid = createMazeGrid(MAZE_COLS, MAZE_ROWS, seededRandom(MAZE_SEED));
const PARTITIONS = buildPartitions(mazeGrid, MAZE_COLS, MAZE_ROWS, CELL_SIZE, ROOM.width, ROOM.depth);

function resolvePartitions(x, z, partitions = PARTITIONS) {
  for (const wall of partitions) {
    const halfW = wall.w / 2;
    const halfD = wall.d / 2;
    const dx = x - wall.x;
    const dz = z - wall.z;
    const closestX = Math.max(-halfW, Math.min(halfW, dx));
    const closestZ = Math.max(-halfD, Math.min(halfD, dz));
    const distX = dx - closestX;
    const distZ = dz - closestZ;
    const distSq = distX * distX + distZ * distZ;
    if (distSq < PLAYER_RADIUS * PLAYER_RADIUS && distSq > 0.000001) {
      const dist = Math.sqrt(distSq);
      const push = PLAYER_RADIUS - dist;
      x += (distX / dist) * push;
      z += (distZ / dist) * push;
    }
  }
  return { x, z };
}

module.exports = {
  ROOM,
  PARTITIONS,
  PLAYER_RADIUS,
  resolvePartitions
};