// Define sky colors for different times (customizable)
const skyColors = [
  { time: 0, color: '#0b1d51' },    // Midnight - dark blue
  { time: 4, color: '#97B4EF' },    // Early Morning - Periwinkle
  { time: 5, color: '#fbbf93' },    // Dawn - soft orange
  { time: 7, color: '#FFBF53' },    // Morning - Orange
  { time: 9, color: '#F7D6A0' },    // Late Morning - soft peach
  { time: 11, color: '#F7E8B5' },   // Late Morning - soft yellow
  { time: 12, color: '#B5F4F7' },   // Noon - soft cyan
  { time: 16, color: '#3AECF2' },   // Afternoon - cyan
  { time: 19, color: '#97B4EF' },   // Evening - Periwinkle
  { time: 21, color: '#191970' },   // Night - midnight blue
  { time: 24, color: '#0b1d51' }    // Midnight again for looping
];

// Get interpolated sky color based on fractional hour
function getSkyColor(hour) {
  for (let i = 0; i < skyColors.length - 1; i++) {
    if (hour >= skyColors[i].time && hour < skyColors[i + 1].time) {
      const start = skyColors[i];
      const end = skyColors[i + 1];
      const ratio = (hour - start.time) / (end.time - start.time);
      return interpolateColor(start.color, end.color, ratio);
    }
  }
  return skyColors[0].color; // fallback
}

// Interpolate between two hex colors by factor [0-1]
function interpolateColor(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const result = {
    r: Math.round(c1.r + factor * (c2.r - c1.r)),
    g: Math.round(c1.g + factor * (c2.g - c1.g)),
    b: Math.round(c1.b + factor * (c2.b - c1.b))
  };
  return rgbToHex(result.r, result.g, result.b);
}

// Convert hex color string to RGB object
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

// Convert RGB values to hex string
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Update the background rect fill color based on current time
function updateBackgroundColor() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60; // fractional hour
  const color = getSkyColor(hour);
  const backgroundRect = document.querySelector('.faewild .background');
  if (backgroundRect) {
    backgroundRect.style.fill = color;
  }
}

// Initial background color update and periodic update every 10 minutes
updateBackgroundColor();
setInterval(updateBackgroundColor, 10 * 60 * 1000);

// Generate feColorMatrix values for warming/cooling effect
// factor: -1 (cool) to +1 (warm), 0 is neutral
function getColorTempMatrix(factor) {
  factor = Math.max(-1, Math.min(1, factor));

  // Adjust RGB multipliers based on factor
  const rMult = 1 + 0.25 * factor;  // up to +30% red
  const gMult = 1 + 0.15 * factor; // up to +15% green
  const bMult = 1 - 0.25 * factor;  // down to -30% blue when warm

  // Return flattened 5x4 matrix string for feColorMatrix
  return `${rMult} 0 0 0 0 0 ${gMult} 0 0 0 0 0 ${bMult} 0 0 0 0 0 1 0`.replace(/\s+/g, ' ').trim();
}

// Update color temperature filter values based on current time
function updateColorTemperature() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  let factor;
  if (hour >= 6 && hour <= 15) {
    // Warmest at noon (12), ramp up/down linearly
    factor = 1 - Math.abs(hour - 12) / 6;
  } else {
    // Cooler at night
    if (hour < 6) {
      factor = -1 + hour / 6; // from -1 at 0 to 0 at 6
    } else {
      factor = -1 + (24 - hour) / 9; // from -1 at 24 to 0 at 15
    }
  }

  const matrix = getColorTempMatrix(factor);
  const colorTempMatrix = document.getElementById('colorTempMatrix');
  if (colorTempMatrix) {
    colorTempMatrix.setAttribute('values', matrix);
  }
}

// Initial color temperature update and periodic update every 5 minutes
updateColorTemperature();
setInterval(updateColorTemperature, 5 * 60 * 1000);

// --- 3D Y-Axis (Wheel) Text Carousel Setup ---

const carousel = document.getElementById('carousel');
const texts = ['F', 'A', 'E', 'W', 'I', 'L', 'D']; // Example text
const radius = 120; // Distance from center for 3D effect
const itemCount = texts.length;

// Create and position text elements around the Y axis, facing outward
texts.forEach((text, i) => {
  const el = document.createElement('div');
  el.className = 'carousel-text';
  el.textContent = text;
  const angle = (360 / itemCount) * i;
  // Outward-facing: rotateY(angle), push out, then rotateY(-angle)
  el.style.transform = `rotateY(${angle}deg) translateZ(${radius}px) rotateY(${-angle}deg)`;
  carousel.appendChild(el);
});

// --- Carousel Rotation Logic (Y axis, outward-facing, natural mouse drag + hover direction) ---

const carouselContainer = document.querySelector('.carousel-container');

let rotationY = 0;
let velocityY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastTimestamp = 0;
const autoSpinSpeed = 0.18; // degrees per frame (~60fps)
const friction = 0.93;

// Direction logic
let spinDirection = 1; // Updated while hovering: 1 for right, -1 for left
let resumeSpinDirection = 1; // Used for auto-spin when not dragging

// Mouse/touch drag events
carouselContainer.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  velocityY = 0;
  lastTimestamp = performance.now();
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  rotationY += dx;
  lastMouseX = e.clientX;

  // Calculate velocity for inertia
  const now = performance.now();
  const dt = (now - lastTimestamp) / 1000;
  velocityY = dx / (dt ? dt : 1);
  lastTimestamp = now;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

// Touch support
carouselContainer.addEventListener('touchstart', (e) => {
  isDragging = true;
  lastMouseX = e.touches[0].clientX;
  velocityY = 0;
  lastTimestamp = performance.now();
});
window.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const dx = e.touches[0].clientX - lastMouseX;
  rotationY += dx;
  lastMouseX = e.touches[0].clientX;

  // Velocity for inertia
  const now = performance.now();
  const dt = (now - lastTimestamp) / 1000;
  velocityY = dx / (dt ? dt : 1);
  lastTimestamp = now;
});
window.addEventListener('touchend', () => {
  isDragging = false;
});

// Track which side of the container is hovered (update spinDirection)
carouselContainer.addEventListener('mousemove', (e) => {
  const rect = carouselContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  spinDirection = (x < rect.width / 2) ? -1 : 1; // Left: -1, Right: 1
});

// On mouse leave, record spin direction for auto-spin
carouselContainer.addEventListener('mouseleave', () => {
  resumeSpinDirection = spinDirection; // Set new direction for auto-spin
});

// Animation loop for rotating carousel around Y axis
function animate() {
  if (!isDragging) {
    rotationY += autoSpinSpeed * resumeSpinDirection;
  } else if (Math.abs(velocityY) > 0.01) {
    rotationY += velocityY * 0.016; // frame time
    velocityY *= friction;
    if (Math.abs(velocityY) < 0.01) velocityY = 0;
  }

  // Update carousel rotation
  carousel.style.transform = `translate(-50%, -50%) rotateY(${rotationY}deg)`;

  // Update each text element's transform to maintain outward-facing
  const elements = carousel.querySelectorAll('.carousel-text');
  elements.forEach((el, i) => {
    const angle = (360 / itemCount) * i;
    el.style.transform = `rotateY(${angle}deg) translateZ(${radius}px) rotateY(${-angle - rotationY}deg)`;
  });

  requestAnimationFrame(animate);
}
animate();