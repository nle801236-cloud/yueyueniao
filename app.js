const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const controls = {
  threshold: document.getElementById("threshold"),
  softness: document.getElementById("softness"),
  flowSpeed: document.getElementById("flowSpeed"),
  wobble: document.getElementById("wobble"),
  attraction: document.getElementById("attraction"),
  resolution: document.getElementById("resolution"),
  glow: document.getElementById("glow"),
  bubbleColor: document.getElementById("bubbleColor"),
  backgroundColor: document.getElementById("backgroundColor"),
};

const toolbarButtons = [...document.querySelectorAll(".tool[data-tool]")];
const randomizeButton = document.getElementById("randomize");
const clearButton = document.getElementById("clear");

const state = {
  tool: "draw",
  width: 0,
  height: 0,
  blobs: [],
  nextId: 1,
  selectedId: null,
  draggingId: null,
  dragMode: null,
  pointerId: null,
  draftBlob: null,
  lastPointer: { x: 0, y: 0 },
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  params: {
    threshold: Number(controls.threshold.value),
    softness: Number(controls.softness.value),
    flowSpeed: Number(controls.flowSpeed.value),
    wobble: Number(controls.wobble.value),
    attraction: Number(controls.attraction.value),
    resolution: Number(controls.resolution.value),
    glow: Number(controls.glow.value),
    bubbleColor: controls.bubbleColor.value,
    backgroundColor: controls.backgroundColor.value,
  },
};

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  const value = cleaned.length === 3
    ? cleaned.split("").map((char) => char + char).join("")
    : cleaned;
  const number = Number.parseInt(value, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function createBlob(x, y, radius = randomBetween(26, 64)) {
  return {
    id: state.nextId++,
    x,
    y,
    radius,
    vx: randomBetween(-0.3, 0.3),
    vy: randomBetween(-0.3, 0.3),
    phase: randomBetween(0, Math.PI * 2),
    drift: randomBetween(0.6, 1.3),
  };
}

function seedBlobs() {
  state.blobs = [];
  const count = window.innerWidth < 900 ? 5 : 8;
  for (let i = 0; i < count; i += 1) {
    state.blobs.push(
      createBlob(
        randomBetween(state.width * 0.16, state.width * 0.84),
        randomBetween(state.height * 0.18, state.height * 0.82),
        randomBetween(32, 78),
      ),
    );
  }
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  state.width = bounds.width;
  state.height = bounds.height;
  canvas.width = Math.round(bounds.width * state.pixelRatio);
  canvas.height = Math.round(bounds.height * state.pixelRatio);
  ctx.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);

  if (state.blobs.length === 0) {
    seedBlobs();
  } else {
    for (const blob of state.blobs) {
      blob.x = clamp(blob.x, blob.radius, state.width - blob.radius);
      blob.y = clamp(blob.y, blob.radius, state.height - blob.radius);
    }
  }
}

function setTool(tool) {
  state.tool = tool;
  for (const button of toolbarButtons) {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  }
  canvas.style.cursor = tool === "draw" ? "crosshair" : "default";
  statusEl.textContent = tool === "draw" ? "模式：绘制气泡" : "模式：编辑形状";
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function getBlobAt(x, y) {
  for (let i = state.blobs.length - 1; i >= 0; i -= 1) {
    const blob = state.blobs[i];
    if (dist(x, y, blob.x, blob.y) <= blob.radius + 8) {
      return blob;
    }
  }
  return null;
}

function getHandleAt(x, y) {
  const selected = state.blobs.find((blob) => blob.id === state.selectedId);
  if (!selected) {
    return null;
  }
  const hx = selected.x + selected.radius;
  const hy = selected.y;
  return dist(x, y, hx, hy) < 14 ? selected : null;
}

function pointerDown(event) {
  const point = getPointerPosition(event);
  state.lastPointer = point;
  canvas.setPointerCapture(event.pointerId);
  state.pointerId = event.pointerId;

  if (state.tool === "draw") {
    const blob = createBlob(point.x, point.y, 8);
    blob.vx = 0;
    blob.vy = 0;
    state.draftBlob = blob;
    state.selectedId = blob.id;
    return;
  }

  const handleBlob = getHandleAt(point.x, point.y);
  if (handleBlob) {
    state.draggingId = handleBlob.id;
    state.dragMode = "resize";
    state.selectedId = handleBlob.id;
    return;
  }

  const hitBlob = getBlobAt(point.x, point.y);
  if (hitBlob) {
    state.draggingId = hitBlob.id;
    state.dragMode = "move";
    state.selectedId = hitBlob.id;
    return;
  }

  state.selectedId = null;
}

function pointerMove(event) {
  const point = getPointerPosition(event);
  state.lastPointer = point;

  if (state.tool === "draw" && state.draftBlob) {
    state.draftBlob.radius = Math.max(12, dist(point.x, point.y, state.draftBlob.x, state.draftBlob.y));
    return;
  }

  if (!state.draggingId) {
    return;
  }

  const blob = state.blobs.find((entry) => entry.id === state.draggingId);
  if (!blob) {
    return;
  }

  if (state.dragMode === "move") {
    blob.x = clamp(point.x, blob.radius, state.width - blob.radius);
    blob.y = clamp(point.y, blob.radius, state.height - blob.radius);
  } else if (state.dragMode === "resize") {
    blob.radius = clamp(dist(point.x, point.y, blob.x, blob.y), 12, Math.min(state.width, state.height) * 0.45);
  }
}

function pointerUp(event) {
  if (state.pointerId === event.pointerId) {
    canvas.releasePointerCapture(event.pointerId);
    state.pointerId = null;
  }

  if (state.tool === "draw" && state.draftBlob) {
    if (state.draftBlob.radius >= 12) {
      state.blobs.push(state.draftBlob);
      state.selectedId = state.draftBlob.id;
    }
    state.draftBlob = null;
  }

  state.draggingId = null;
  state.dragMode = null;
}

function deleteSelected() {
  if (state.selectedId == null) {
    return;
  }
  state.blobs = state.blobs.filter((blob) => blob.id !== state.selectedId);
  state.selectedId = null;
}

function updateParams() {
  state.params.threshold = Number(controls.threshold.value);
  state.params.softness = Number(controls.softness.value);
  state.params.flowSpeed = Number(controls.flowSpeed.value);
  state.params.wobble = Number(controls.wobble.value);
  state.params.attraction = Number(controls.attraction.value);
  state.params.resolution = Number(controls.resolution.value);
  state.params.glow = Number(controls.glow.value);
  state.params.bubbleColor = controls.bubbleColor.value;
  state.params.backgroundColor = controls.backgroundColor.value;
}

function updateBlobs(time) {
  const t = time * 0.001;

  for (let i = 0; i < state.blobs.length; i += 1) {
    const blob = state.blobs[i];
    if (blob.id === state.draggingId || blob.id === state.draftBlob?.id) {
      continue;
    }

    const wiggle = state.params.wobble * 0.0014;
    blob.vx += Math.cos(t * state.params.flowSpeed * blob.drift + blob.phase) * wiggle;
    blob.vy += Math.sin(t * state.params.flowSpeed * blob.drift * 0.9 + blob.phase * 0.7) * wiggle;

    for (let j = i + 1; j < state.blobs.length; j += 1) {
      const other = state.blobs[j];
      if (other.id === state.draggingId || other.id === state.draftBlob?.id) {
        continue;
      }
      const dx = other.x - blob.x;
      const dy = other.y - blob.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desired = (blob.radius + other.radius) * 1.24;
      if (distance > desired) {
        const pull = (distance - desired) * state.params.attraction * 0.0022;
        blob.vx += dx * pull;
        blob.vy += dy * pull;
        other.vx -= dx * pull;
        other.vy -= dy * pull;
      }
    }
  }

  for (const blob of state.blobs) {
    if (blob.id === state.draggingId || blob.id === state.draftBlob?.id) {
      continue;
    }

    blob.x += blob.vx;
    blob.y += blob.vy;
    blob.vx *= 0.985;
    blob.vy *= 0.985;

    if (blob.x < blob.radius) {
      blob.x = blob.radius;
      blob.vx *= -0.75;
    }
    if (blob.x > state.width - blob.radius) {
      blob.x = state.width - blob.radius;
      blob.vx *= -0.75;
    }
    if (blob.y < blob.radius) {
      blob.y = blob.radius;
      blob.vy *= -0.75;
    }
    if (blob.y > state.height - blob.radius) {
      blob.y = state.height - blob.radius;
      blob.vy *= -0.75;
    }
  }
}

function renderField() {
  const res = state.params.resolution;
  const cols = Math.max(40, Math.floor(res * (state.width / Math.max(state.height, 1))));
  const rows = Math.max(40, res);
  const cellW = state.width / cols;
  const cellH = state.height / rows;
  const rgb = hexToRgb(state.params.bubbleColor);
  const bg = hexToRgb(state.params.backgroundColor);

  ctx.clearRect(0, 0, state.width, state.height);

  const gradient = ctx.createRadialGradient(
    state.width * 0.4,
    state.height * 0.32,
    20,
    state.width * 0.5,
    state.height * 0.5,
    Math.max(state.width, state.height) * 0.72,
  );
  gradient.addColorStop(0, `rgba(${bg.r + 20}, ${bg.g + 18}, ${bg.b + 30}, 0.4)`);
  gradient.addColorStop(1, `rgba(${bg.r}, ${bg.g}, ${bg.b}, 1)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const sampleX = x * cellW + cellW * 0.5;
      const sampleY = y * cellH + cellH * 0.5;

      let field = 0;
      for (const blob of state.blobs) {
        const dx = sampleX - blob.x;
        const dy = sampleY - blob.y;
        field += (blob.radius * blob.radius) / (dx * dx + dy * dy + 0.0001);
      }
      if (state.draftBlob) {
        const dx = sampleX - state.draftBlob.x;
        const dy = sampleY - state.draftBlob.y;
        field += (state.draftBlob.radius * state.draftBlob.radius) / (dx * dx + dy * dy + 0.0001);
      }

      const density = clamp(
        (field - state.params.threshold) / Math.max(state.params.softness, 0.0001),
        0,
        1,
      );
      if (density < 0.02) {
        continue;
      }

      const alpha = density * 0.88;
      const glowBoost = 1 + density * state.params.glow * 0.7;
      const r = clamp(Math.round(rgb.r * glowBoost), 0, 255);
      const g = clamp(Math.round(rgb.g * glowBoost), 0, 255);
      const b = clamp(Math.round(rgb.b * (1 + state.params.glow * 0.26)), 0, 255);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
    }
  }
}

function renderOverlays() {
  const selected = state.blobs.find((blob) => blob.id === state.selectedId) || state.draftBlob;
  if (!selected) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.76)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.arc(selected.x, selected.y, selected.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (state.tool === "edit") {
    const handleX = selected.x + selected.radius;
    const handleY = selected.y;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(selected.x, selected.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7ce8ff";
    ctx.beginPath();
    ctx.arc(handleX, handleY, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function render(time) {
  updateBlobs(time);
  renderField();
  renderOverlays();
  requestAnimationFrame(render);
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      deleteSelected();
    }
    if (event.key.toLowerCase() === "v") {
      setTool("edit");
    }
    if (event.key.toLowerCase() === "b") {
      setTool("draw");
    }
  });

  for (const button of toolbarButtons) {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  }

  randomizeButton.addEventListener("click", () => {
    seedBlobs();
    state.selectedId = null;
  });

  clearButton.addEventListener("click", () => {
    state.blobs = [];
    state.selectedId = null;
  });

  for (const control of Object.values(controls)) {
    control.addEventListener("input", updateParams);
  }
}

resizeCanvas();
bindEvents();
setTool("draw");
requestAnimationFrame(render);
