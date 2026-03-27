import './style.css';
import {
  createGrid,
  fillGrid,
  processMove,
  getDiagonalLine,
  hasValidMove,
} from './engine/engine';
import {
  NUM_ROWS,
  NUM_COLS,
  type DiagonalType,
  type GridData,
  type RowDirection,
  type SlideDirection,
  type Tile,
} from './engine/types';

type DragKind = 'row' | 'sum' | 'diff';
interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  row: number;
  col: number;
  kind: DragKind | null;
}

interface HighlightState {
  kind: DragKind;
  row: number;
  col: number;
}

interface Point {
  x: number;
  y: number;
}

interface CellRef {
  r: number;
  c: number;
}

interface TileVisual {
  tile: Tile;
  from: Point;
  to: Point;
  fromOrientation: Tile['orientation'];
  toOrientation: Tile['orientation'];
  fromVisible: boolean;
  toVisible: boolean;
}

interface AnimationState {
  startedAt: number;
  durationMs: number;
  visuals: TileVisual[];
  matchBursts: Point[];
  nextGrid: GridData;
  scoreDelta: number;
  nextGameOver: boolean;
}

const TILE_COLORS: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#facc15',
  purple: '#a855f7',
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('app not found');

app.innerHTML = `
  <div class="shell">
    <div class="topbar">
      <div>
        <h1>TriSlide</h1>
        <p>Canvas renderer prototype</p>
      </div>
      <div class="stats">
        <div><span>Score</span><strong id="score">0</strong></div>
        <div><span>Status</span><strong id="status">Ready</strong></div>
      </div>
    </div>
    <div class="toolbar">
      <button id="new-game" type="button">New game</button>
      <button id="reshuffle" type="button">Reshuffle</button>
      <span class="toolbar-note">Drag horizontally for rows, diagonally for slash moves.</span>
    </div>
    <div class="board-wrap">
      <canvas id="board"></canvas>
      <div class="overlay hidden" id="overlay">
        <div class="overlay-card">
          <h2 id="overlay-title">No moves left</h2>
          <p id="overlay-body">Start a fresh board or reshuffle this one.</p>
          <div class="overlay-actions">
            <button id="overlay-new-game" type="button">New game</button>
            <button id="overlay-reshuffle" type="button">Reshuffle</button>
          </div>
        </div>
      </div>
    </div>
    <div class="help" id="help-text">
      Click a triangle, then drag <b>left/right</b> to slide a row. Drag <b>down-right</b> for \ diagonals. Drag <b>down-left</b> for / diagonals.
    </div>
  </div>
`;

const canvasEl = document.querySelector<HTMLCanvasElement>('#board');
const scoreNode = document.querySelector<HTMLElement>('#score');
const statusNode = document.querySelector<HTMLElement>('#status');
const helpNode = document.querySelector<HTMLElement>('#help-text');
const newGameBtn = document.querySelector<HTMLButtonElement>('#new-game');
const reshuffleBtn = document.querySelector<HTMLButtonElement>('#reshuffle');
const overlayNode = document.querySelector<HTMLDivElement>('#overlay');
const overlayTitleNode = document.querySelector<HTMLElement>('#overlay-title');
const overlayBodyNode = document.querySelector<HTMLElement>('#overlay-body');
const overlayNewGameBtn = document.querySelector<HTMLButtonElement>('#overlay-new-game');
const overlayReshuffleBtn = document.querySelector<HTMLButtonElement>('#overlay-reshuffle');
if (!canvasEl || !scoreNode || !statusNode || !helpNode || !newGameBtn || !reshuffleBtn || !overlayNode || !overlayTitleNode || !overlayBodyNode || !overlayNewGameBtn || !overlayReshuffleBtn) throw new Error('ui missing');
const canvas = canvasEl;
const scoreEl = scoreNode;
const statusEl = statusNode;
const helpEl = helpNode;
const overlayEl = overlayNode;
const overlayTitleEl = overlayTitleNode;
const overlayBodyEl = overlayBodyNode;
const overlayNewGame = overlayNewGameBtn;
const overlayReshuffle = overlayReshuffleBtn;

const ctx2d = canvas.getContext('2d');
if (!ctx2d) throw new Error('2d context unavailable');
const ctx = ctx2d;

let grid: GridData;
let score = 0;
let drag: DragState | null = null;
let highlight: HighlightState | null = null;
let flashUntil = 0;
let flashColor = '#f8fafc';
let isGameOver = false;
let animation: AnimationState | null = null;
let animationFrame = 0;

const padding = 20;
const side = 28;
const triHeight = side * Math.sqrt(3) / 2;
const boardWidth = NUM_COLS * (side / 2) + side / 2;
const boardHeight = NUM_ROWS * triHeight;
canvas.width = Math.ceil(boardWidth + padding * 2);
canvas.height = Math.ceil(boardHeight + padding * 2);

const keyOf = (r: number, c: number) => `${r},${c}`;

function makeFreshGrid(): GridData {
  let next = fillGrid(createGrid(NUM_ROWS, NUM_COLS));
  let guard = 0;
  while (!hasValidMove(next) && guard < 100) {
    next = fillGrid(createGrid(NUM_ROWS, NUM_COLS));
    guard++;
  }
  return next;
}

function setOverlay(visible: boolean, title = 'No moves left', body = 'Start a fresh board or reshuffle this one.') {
  overlayEl.classList.toggle('hidden', !visible);
  overlayTitleEl.textContent = title;
  overlayBodyEl.textContent = body;
}

function resetGame(status = 'New game ready') {
  stopAnimation();
  grid = makeFreshGrid();
  score = 0;
  isGameOver = false;
  scoreEl.textContent = '0';
  setOverlay(false);
  setStatus(status);
  highlight = null;
  draw();
}

function trianglePoints(r: number, c: number, orientation?: Tile['orientation']) {
  const up = orientation ? orientation === 'up' : (r + c) % 2 === 0;
  const x = padding + c * (side / 2);
  const y = padding + r * triHeight;
  return up
    ? [
        { x: x + side / 2, y },
        { x, y: y + triHeight },
        { x: x + side, y: y + triHeight },
      ]
    : [
        { x, y },
        { x: x + side, y },
        { x: x + side / 2, y: y + triHeight },
      ];
}

function triangleCenter(r: number, c: number) {
  const pts = trianglePoints(r, c);
  return {
    x: (pts[0].x + pts[1].x + pts[2].x) / 3,
    y: (pts[0].y + pts[1].y + pts[2].y) / 3,
  };
}

function pointInTriangle(px: number, py: number, pts: Point[]) {
  const [a, b, c] = pts;
  const area = (p1: Point, p2: Point, p3: Point) =>
    Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);
  const A = area(a, b, c);
  const A1 = area({ x: px, y: py }, b, c);
  const A2 = area(a, { x: px, y: py }, c);
  const A3 = area(a, b, { x: px, y: py });
  return Math.abs(A - (A1 + A2 + A3)) < 0.5;
}

function nearestCell(x: number, y: number): CellRef | null {
  let best: CellRef | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const center = triangleCenter(r, c);
      const dx = x - center.x;
      const dy = y - center.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = { r, c };
      }
    }
  }

  return best;
}

function cellAt(x: number, y: number) {
  const nearest = nearestCell(x, y);
  if (!nearest) return null;

  const candidates: CellRef[] = [nearest];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = nearest.r + dr;
      const c = nearest.c + dc;
      if (r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS) candidates.push({ r, c });
    }
  }

  for (const candidate of candidates) {
    if (pointInTriangle(x, y, trianglePoints(candidate.r, candidate.c))) return candidate;
  }

  return nearest;
}

function getHighlightSet(active: HighlightState | null) {
  const set = new Set<string>();
  if (!active) return set;
  if (active.kind === 'row') {
    for (let c = 0; c < NUM_COLS; c++) set.add(keyOf(active.row, c));
  } else {
    const line = getDiagonalLine(grid, active.row, active.col, active.kind as DiagonalType);
    line.forEach(({ r, c }) => set.add(keyOf(r, c)));
  }
  return set;
}

function getHighlightColors(active: HighlightState | null) {
  if (!active) {
    return {
      fill: 'rgba(248,250,252,0.08)',
      stroke: '#f8fafc',
    };
  }

  if (active.kind === 'row') {
    return {
      fill: 'rgba(56,189,248,0.22)',
      stroke: '#38bdf8',
    };
  }

  if (active.kind === 'sum') {
    return {
      fill: 'rgba(168,85,247,0.22)',
      stroke: '#c084fc',
    };
  }

  return {
    fill: 'rgba(34,197,94,0.22)',
    stroke: '#4ade80',
  };
}

function getGridTileMap(source: GridData) {
  const map = new Map<string, Tile>();
  for (const row of source) {
    for (const tile of row) {
      if (tile) map.set(tile.id, tile);
    }
  }
  return map;
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function drawTileAt(tile: Tile, center: Point, orientation: Tile['orientation'], alpha = 1) {
  const drawX = center.x - side / 2;
  const drawY = center.y - triHeight / 2;
  const pts = orientation === 'up'
    ? [
        { x: drawX + side / 2, y: drawY },
        { x: drawX, y: drawY + triHeight },
        { x: drawX + side, y: drawY + triHeight },
      ]
    : [
        { x: drawX, y: drawY },
        { x: drawX + side, y: drawY },
        { x: drawX + side / 2, y: drawY + triHeight },
      ];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.closePath();
  ctx.fillStyle = TILE_COLORS[tile.color];
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#334155';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function buildAnimationState(fromGrid: GridData, toGrid: GridData, scoreDelta: number, nextGameOver: boolean): AnimationState {
  const fromMap = getGridTileMap(fromGrid);
  const toMap = getGridTileMap(toGrid);
  const visuals: TileVisual[] = [];
  const matchBursts: Point[] = [];
  const ids = new Set([...fromMap.keys(), ...toMap.keys()]);

  ids.forEach((id) => {
    const fromTile = fromMap.get(id);
    const toTile = toMap.get(id);

    if (!fromTile && !toTile) return;

    const fromCenter = fromTile ? triangleCenter(fromTile.row, fromTile.col) : toTile ? triangleCenter(toTile.row, toTile.col) : { x: 0, y: 0 };
    const toCenter = toTile ? triangleCenter(toTile.row, toTile.col) : fromTile ? triangleCenter(fromTile.row, fromTile.col) : { x: 0, y: 0 };

    if (fromTile && !toTile) matchBursts.push(fromCenter);

    visuals.push({
      tile: toTile ?? fromTile!,
      from: fromCenter,
      to: toCenter,
      fromOrientation: fromTile?.orientation ?? (toTile?.orientation ?? 'up'),
      toOrientation: toTile?.orientation ?? (fromTile?.orientation ?? 'up'),
      fromVisible: Boolean(fromTile),
      toVisible: Boolean(toTile),
    });
  });

  return {
    startedAt: performance.now(),
    durationMs: scoreDelta > 0 ? 320 : 180,
    visuals,
    matchBursts,
    nextGrid: toGrid,
    scoreDelta,
    nextGameOver,
  };
}

function finishAnimation() {
  if (!animation) return;
  const completed = animation;
  animation = null;
  animationFrame = 0;
  grid = completed.nextGrid;
  if (completed.scoreDelta > 0) {
    score += completed.scoreDelta;
    scoreEl.textContent = String(score);
    flash('#22c55e');
    if (completed.nextGameOver) {
      isGameOver = true;
      setOverlay(true, 'No moves left', `Final score: ${score}. Start a new board or reshuffle.`);
      setStatus('Game over — no valid moves');
    } else {
      setOverlay(false);
      setStatus(`Move applied · +${completed.scoreDelta}`);
    }
  }
  draw();
}

function stopAnimation() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }
  animation = null;
}

function tickAnimation() {
  if (!animation) return;
  draw();
  const elapsed = performance.now() - animation.startedAt;
  if (elapsed >= animation.durationMs) {
    finishAnimation();
    return;
  }
  animationFrame = requestAnimationFrame(tickAnimation);
}

function drawBoardBase() {
  const highlightSet = getHighlightSet(highlight);
  const flashing = Date.now() < flashUntil;
  const highlightColors = getHighlightColors(highlight);

  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const pts = trianglePoints(r, c);
      const selected = highlightSet.has(keyOf(r, c));

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath();
      ctx.fillStyle = selected ? highlightColors.fill : '#111827';
      ctx.fill();
      ctx.lineWidth = selected ? 4 : 1;
      ctx.strokeStyle = selected ? (flashing ? flashColor : highlightColors.stroke) : '#334155';
      if (selected) {
        ctx.save();
        ctx.shadowColor = highlightColors.stroke;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }
    }
  }
}

function drawAnimationFrame(active: AnimationState) {
  const elapsed = Math.min(performance.now() - active.startedAt, active.durationMs);
  const t = easeInOut(elapsed / active.durationMs);
  drawBoardBase();

  active.visuals.forEach((visual) => {
    const center = {
      x: lerp(visual.from.x, visual.to.x, t),
      y: lerp(visual.from.y, visual.to.y, t),
    };
    const orientation = t < 0.5 ? visual.fromOrientation : visual.toOrientation;
    let alpha = 1;

    if (!visual.fromVisible && visual.toVisible) {
      alpha = Math.max(0, Math.min(1, (t - 0.2) / 0.8));
    } else if (visual.fromVisible && !visual.toVisible) {
      alpha = Math.max(0, 1 - t * 1.2);
    }

    drawTileAt(visual.tile, center, orientation, alpha);
  });

  if (active.scoreDelta > 0) {
    const pulse = Math.max(0, 1 - t);
    active.matchBursts.forEach((center) => {
      ctx.save();
      ctx.globalAlpha = pulse * 0.7;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 8 + t * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }
}

function getDragPreviewOffset(activeDrag: DragState | null, r: number, c: number) {
  if (!activeDrag || !activeDrag.kind) return { x: 0, y: 0 };
  const selected = getHighlightSet({ kind: activeDrag.kind, row: activeDrag.row, col: activeDrag.col });
  if (!selected.has(keyOf(r, c))) return { x: 0, y: 0 };

  const dx = activeDrag.currentX - activeDrag.startX;
  const dy = activeDrag.currentY - activeDrag.startY;

  if (activeDrag.kind === 'row') {
    const clamped = Math.max(-side * 0.45, Math.min(side * 0.45, dx * 0.45));
    return { x: clamped, y: 0 };
  }

  const magnitude = Math.max(0, Math.min(triHeight * 0.45, Math.hypot(dx, dy) * 0.35));
  if (activeDrag.kind === 'sum') {
    return { x: magnitude * 0.5, y: magnitude * 0.86 };
  }

  return { x: -magnitude * 0.5, y: magnitude * 0.86 };
}

function drawStaticBoard() {
  const highlightSet = getHighlightSet(highlight);
  const flashing = Date.now() < flashUntil;
  const highlightColors = getHighlightColors(highlight);

  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const pts = trianglePoints(r, c);
      const tile = grid[r]?.[c];
      const selected = highlightSet.has(keyOf(r, c));

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath();
      ctx.fillStyle = '#111827';
      ctx.fill();

      if (selected) {
        ctx.save();
        ctx.fillStyle = highlightColors.fill;
        ctx.fill();
        ctx.restore();
      }

      ctx.lineWidth = selected ? 4 : 1;
      ctx.strokeStyle = selected ? (flashing ? flashColor : highlightColors.stroke) : '#334155';
      if (selected) {
        ctx.save();
        ctx.shadowColor = highlightColors.stroke;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }

      if (tile) {
        const center = triangleCenter(r, c);
        const offset = getDragPreviewOffset(drag, r, c);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        drawTileAt(tile, { x: center.x + offset.x, y: center.y + offset.y }, tile.orientation, selected ? 0.98 : 1);
      }
    }
  }
}

function drawGesturePreview(activeDrag: DragState) {
  const start = triangleCenter(activeDrag.row, activeDrag.col);
  const end = { x: activeDrag.currentX, y: activeDrag.currentY };
  const previewKind = activeDrag.kind ?? classifyDrag(activeDrag.currentX - activeDrag.startX, activeDrag.currentY - activeDrag.startY);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);

  if (distance < 8) return;

  const previewColor = previewKind ? '#38bdf8' : 'rgba(248,250,252,0.45)';
  ctx.save();
  ctx.strokeStyle = previewColor;
  ctx.fillStyle = previewColor;
  ctx.lineWidth = 3;
  ctx.setLineDash(previewKind ? [] : [6, 6]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 10;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - Math.cos(angle - Math.PI / 6) * head, end.y - Math.sin(angle - Math.PI / 6) * head);
  ctx.lineTo(end.x - Math.cos(angle + Math.PI / 6) * head, end.y - Math.sin(angle + Math.PI / 6) * head);
  ctx.closePath();
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (animation) {
    drawAnimationFrame(animation);
  } else {
    drawStaticBoard();
    if (drag) drawGesturePreview(drag);
  }
}

function setStatus(text: string) {
  statusEl.textContent = text;
}

function flash(kindColor: string) {
  flashUntil = Date.now() + 140;
  flashColor = kindColor;
  draw();
  window.setTimeout(() => {
    if (Date.now() >= flashUntil) draw();
  }, 150);
}

function classifyDrag(dx: number, dy: number): DragKind | null {
  const distance = Math.hypot(dx, dy);
  if (distance < 20) return null;

  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const DIAGONAL_DEAD_ZONE = 14;
  const ROW_DEAD_ZONE = 16;

  if (Math.abs(angle) <= ROW_DEAD_ZONE || Math.abs(Math.abs(angle) - 180) <= ROW_DEAD_ZONE) {
    return 'row';
  }

  if (dy <= 0) return null;

  if (Math.abs(angle - 60) <= DIAGONAL_DEAD_ZONE) return 'sum';
  if (Math.abs(angle - 120) <= DIAGONAL_DEAD_ZONE) return 'diff';

  return null;
}

function applyDragMove(state: DragState, dx: number, dy: number) {
  if (isGameOver || animation) return;
  const kind = state.kind ?? classifyDrag(dx, dy);
  if (!kind) {
    setStatus('Drag farther to make a move');
    highlight = null;
    draw();
    return;
  }

  let result;

  if (kind === 'row') {
    const dir: RowDirection = dx < 0 ? 'left' : 'right';
    result = processMove(grid, 'row', state.row, dir, 1);
    highlight = { kind, row: state.row, col: state.col };
    setStatus(`Row ${state.row + 1} ${dir}`);
  } else {
    const dir: SlideDirection = dy < 0 ? 'backward' : 'forward';
    result = processMove(grid, kind, { r: state.row, c: state.col }, dir, 1);
    highlight = { kind, row: state.row, col: state.col };
    setStatus(`${kind === 'sum' ? '\\' : '/'} diagonal ${dir}`);
  }

  if (result.scoreDelta > 0) {
    const nextGameOver = !hasValidMove(result.grid);
    animation = buildAnimationState(grid, result.grid, result.scoreDelta, nextGameOver);
    setOverlay(false);
    setStatus(`Animating move · +${result.scoreDelta}`);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(tickAnimation);
  } else {
    flash('#ef4444');
    setStatus('No match from that move');
    draw();
  }
}

canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const cell = cellAt(x, y);
  if (!cell || isGameOver || animation) return;
  drag = { startX: x, startY: y, currentX: x, currentY: y, row: cell.r, col: cell.c, kind: null };
  highlight = { kind: 'row', row: cell.r, col: cell.c };
  canvas.setPointerCapture(event.pointerId);
  setStatus(`Triangle selected · row ${cell.r + 1}`);
  draw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag || animation) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  drag.currentX = x;
  drag.currentY = y;
  const dx = x - drag.startX;
  const dy = y - drag.startY;
  const kind = classifyDrag(dx, dy);

  if (!kind) {
    drag.kind = null;
    if (Math.hypot(dx, dy) >= 20) {
      highlight = { kind: 'row', row: drag.row, col: drag.col };
      setStatus('Drag left/right, down-right, or down-left');
      draw();
    }
    return;
  }

  drag.kind = kind;
  highlight = { kind, row: drag.row, col: drag.col };
  if (kind === 'row') setStatus(`Row ${drag.row + 1} selected`);
  if (kind === 'sum') setStatus('\\ diagonal selected');
  if (kind === 'diff') setStatus('/ diagonal selected');
  draw();
});

canvas.addEventListener('pointerup', (event) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const dx = x - drag.startX;
  const dy = y - drag.startY;
  applyDragMove(drag, dx, dy);
  drag = null;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  drag = null;
  highlight = null;
  setStatus('Move cancelled');
  draw();
});

newGameBtn.addEventListener('click', () => resetGame());
reshuffleBtn.addEventListener('click', () => {
  stopAnimation();
  grid = makeFreshGrid();
  isGameOver = false;
  highlight = null;
  setOverlay(false);
  setStatus('Board reshuffled');
  draw();
});
overlayNewGame.addEventListener('click', () => resetGame());
overlayReshuffle.addEventListener('click', () => {
  stopAnimation();
  grid = makeFreshGrid();
  isGameOver = false;
  highlight = null;
  setOverlay(false);
  setStatus('Board reshuffled');
  draw();
});

helpEl.textContent = 'Drag horizontally for rows, or drag down-left/down-right for diagonal moves. Ambiguous angles now wait for a clearer swipe instead of guessing.';
resetGame(hasValidMove(makeFreshGrid()) ? 'Ready' : 'New game ready');
