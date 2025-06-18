// --- SKY COLOR & TEMPERATURE ---

const skyColors = [
  { time: 0, color: '#0b1d51' }, { time: 4, color: '#97B4EF' }, { time: 5, color: '#fbbf93' },
  { time: 7, color: '#FFBF53' }, { time: 9, color: '#F7D6A0' }, { time: 11, color: '#F7E8B5' },
  { time: 12, color: '#B5F4F7' }, { time: 16, color: '#3AECF2' }, { time: 19, color: '#97B4EF' },
  { time: 21, color: '#191970' }, { time: 24, color: '#0b1d51' }
];

const getSkyColor = hour => {
  for (let i = 0; i < skyColors.length - 1; i++) {
    if (hour >= skyColors[i].time && hour < skyColors[i + 1].time) {
      const { color: c1, time: t1 } = skyColors[i], { color: c2, time: t2 } = skyColors[i + 1];
      return interpolateColor(c1, c2, (hour - t1) / (t2 - t1));
    }
  }
  return skyColors[0].color;
};

const interpolateColor = (a, b, f) => {
  const c1 = hexToRgb(a), c2 = hexToRgb(b);
  return rgbToHex(
    Math.round(c1.r + f * (c2.r - c1.r)),
    Math.round(c1.g + f * (c2.g - c1.g)),
    Math.round(c1.b + f * (c2.b - c1.b))
  );
};
const hexToRgb = hex => {
  hex = hex.replace('#', '');
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
};
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

// Update SVG rect fill for background
function updateBackgroundColor() {
  const now = new Date(), hour = now.getHours() + now.getMinutes() / 60;
  const rect = document.querySelector('.faewild .background');
  if (rect) rect.style.fill = getSkyColor(hour);
}
setInterval(updateBackgroundColor, 10 * 60 * 1000);
updateBackgroundColor();

// Color temperature filter matrix
function getColorTempMatrix(factor) {
  factor = Math.max(-1, Math.min(1, factor));
  const r = 1 + 0.25 * factor, g = 1 + 0.15 * factor, b = 1 - 0.25 * factor;
  return `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0`.replace(/\s+/g, ' ').trim();
}
function updateColorTemperature() {
  const now = new Date(), hour = now.getHours() + now.getMinutes() / 60;
  let factor = hour >= 6 && hour <= 15 ? 1 - Math.abs(hour - 12) / 6
    : hour < 6 ? -1 + hour / 6 : -1 + (24 - hour) / 9;
  const el = document.getElementById('colorTempMatrix');
  if (el) el.setAttribute('values', getColorTempMatrix(factor));
}
setInterval(updateColorTemperature, 5 * 60 * 1000);
updateColorTemperature();

// --- MOON ROTATION ---
const moonContainer = document.querySelector('.moon-container');
if (moonContainer) {
  const days = Math.floor((Date.now() - new Date(2025, 5, 26)) / (1000 * 60 * 60 * 24));
  moonContainer.style.transform = `rotate(${(days / 29.5) * 360}deg)`;
}

// --- 3D TEXT CAROUSEL ---
const carousel = document.getElementById('carousel'),
  texts = ['F', 'A', 'E', 'W', 'I', 'L', 'D'],
  // Responsive radius for all devices //
  radius = window.innerWidth / 1.15,
  itemCount = texts.length,
  carouselContainer = document.querySelector('.carousel-container');
let rotationY = 0, velocityY = 0, isDragging = false, lastMouseX = 0, lastTimestamp = 0;
let hoverVelocity = 0, useHoverVelocity = false, resumeSpinDirection = 1;
const maxVelocity = 2.5, minVelocity = 0.18;

texts.forEach((text, i) => {
  const el = document.createElement('div');
  el.className = 'carousel-text';
  el.textContent = text;
  el.style.transform = `rotateY(${(360 / itemCount) * i}deg) translateZ(${radius}px) rotateY(-${(360 / itemCount) * i}deg)`;
  carousel.appendChild(el);
});

// --- Unified Pointer Utilities ---
function getClientX(e) {
  if (e.touches && e.touches.length) return e.touches[0].clientX;
  if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
  return e.clientX;
}

// --- DRAG LOGIC (mouse + touch) ---
function startDrag(e) {
  isDragging = true;
  lastMouseX = getClientX(e);
  velocityY = 0;
  lastTimestamp = performance.now();
  useHoverVelocity = false;
  carouselContainer.style.cursor = 'none';
  if (e.preventDefault) e.preventDefault();
}
function dragMove(e) {
  if (!isDragging) return;
  const dx = getClientX(e) - lastMouseX;
  rotationY += dx;
  lastMouseX = getClientX(e);
  const now = performance.now(), dt = (now - lastTimestamp) / 1000;
  velocityY = dx / (dt || 1);
  lastTimestamp = now;
  handleSkyAndTempInteraction(e, true);
}
function endDrag() {
  isDragging = false;
  carouselContainer.style.cursor = 'default';
}

// --- HOVER LOGIC (mouse + touch) ---
function handleHover(e) {
  if (isDragging) return;
  const rect = carouselContainer.getBoundingClientRect();
  const x = getClientX(e) - rect.left;
  const center = rect.width / 2;
  const rel = (x - center) / center;
  hoverVelocity = rel * maxVelocity;
  useHoverVelocity = true;
  resumeSpinDirection = rel < 0 ? -1 : 1;
}
function endHover() {
  useHoverVelocity = false;
}

// --- SKY COLOR & TEMP ON DRAG (mouse + touch) ---
let skyColorTimeout = null, colorTempTimeout = null;
const resetSkyTemp = () => { updateBackgroundColor(); updateColorTemperature(); };

function handleSkyAndTempInteraction(e, isDrag) {
  const rect = carouselContainer.getBoundingClientRect();
  const x = getClientX(e) - rect.left;
  const center = rect.width / 1;
  const rel = (x - center) / center, hour = 12 + rel * 12;
  document.querySelector('.faewild .background').style.fill = getSkyColor(hour);
  if (skyColorTimeout) clearTimeout(skyColorTimeout);
  skyColorTimeout = setTimeout(resetSkyTemp, 5000);

  let factor = Math.max(-1, Math.min(1, rel < 0 ? -1 + (1 + rel) * 2 : 1 - (1 - rel) * 2));
  const colorTempMatrix = document.getElementById('colorTempMatrix');
  if (colorTempMatrix) colorTempMatrix.setAttribute('values', getColorTempMatrix(factor));
  if (colorTempTimeout) clearTimeout(colorTempTimeout);
  colorTempTimeout = setTimeout(updateColorTemperature, 5000);
}

// --- EVENT BINDINGS (mouse + touch) ---

carouselContainer.addEventListener('mousedown', startDrag);
carouselContainer.addEventListener('touchstart', startDrag);

window.addEventListener('mousemove', dragMove);
window.addEventListener('touchmove', dragMove, { passive: false });

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

carouselContainer.addEventListener('mousemove', handleHover);
carouselContainer.addEventListener('touchmove', handleHover);

carouselContainer.addEventListener('mouseleave', endHover);
carouselContainer.addEventListener('touchcancel', endHover);

// --- ANIMATION LOOP ---
function animate() {
  if (isDragging && Math.abs(velocityY) > 0.01) {
    rotationY += velocityY * 0.016; velocityY *= 0.93;
    if (Math.abs(velocityY) < 0.01) velocityY = 0;
  } else if (useHoverVelocity) {
    rotationY += hoverVelocity;
  } else {
    rotationY += minVelocity * resumeSpinDirection;
  }
  carousel.style.transform = `translate(-50%, -50%) rotateY(${rotationY}deg)`;
  const elements = carousel.querySelectorAll('.carousel-text');
  elements.forEach((el, i) => {
    const angle = (360 / itemCount) * i;
    el.style.transform = `rotateY(${angle}deg) translateZ(${radius}px) rotateY(-${angle + rotationY}deg)`;
    const normAngle = ((angle + rotationY) % 360 + 360) % 360;
    el.style.opacity = Math.max(0, Math.cos(normAngle * Math.PI / 180)).toFixed(2);
  });
  requestAnimationFrame(animate);
}
animate();