<template>
  <div class="faewild">
    <svg class="background" width="100vw" height="100vh">
      <rect width="100%" height="100%" :fill="backgroundFill" />
      <filter id="colorTempMatrix">
        <feColorMatrix
          type="matrix"
          :values="colorTempMatrix"
        />
      </filter>
    </svg>
    <div class="moon-container" :style="{ transform: moonTransform }">
      <!-- Moon SVG or image goes here -->
    </div>
    <div
      class="carousel-container"
      ref="carouselContainer"
      @mousedown="startDrag"
      @touchstart="startDrag"
      @mousemove="handleHover"
      @touchmove="handleHover"
      @mouseleave="endHover"
      @touchcancel="endHover"
    >
      <div
        id="carousel"
        :style="{ transform: carouselTransform }"
      >
        <div
          v-for="(text, i) in texts"
          :key="i"
          class="carousel-text"
          :style="getTextStyle(i)"
        >
          {{ text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'

// --- DATA (could be moved to a composable or external file) ---
const skyColors = [
  { time: 0, color: '#0b1d51' }, { time: 4, color: '#97B4EF' }, { time: 5, color: '#fbbf93' },
  { time: 7, color: '#FFBF53' }, { time: 9, color: '#F7D6A0' }, { time: 11, color: '#F7E8B5' },
  { time: 12, color: '#B5F4F7' }, { time: 16, color: '#3AECF2' }, { time: 19, color: '#97B4EF' },
  { time: 21, color: '#191970' }, { time: 24, color: '#0b1d51' }
]
const texts = ['F', 'A', 'E', 'W', 'I', 'L', 'D']
const radius = 205
const itemCount = texts.length

// --- REACTIVE STATE ---
const backgroundFill = ref('#0b1d51')
const colorTempMatrix = ref('1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0')
const moonTransform = ref('')
const isDragging = ref(false)
const rotationY = ref(0)
const velocityY = ref(0)
const lastMouseX = ref(0)
const lastTimestamp = ref(0)
const hoverVelocity = ref(0)
const useHoverVelocity = ref(false)
const resumeSpinDirection = ref(1)
const maxVelocity = 2.5
const minVelocity = 0.18
const skyColorTimeout = ref(null)
const colorTempTimeout = ref(null)
const carouselContainer = ref(null)

// --- UTILS ---
function hexToRgb(hex) {
  hex = hex.replace('#', '')
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}
function interpolateColor(a, b, f) {
  const c1 = hexToRgb(a), c2 = hexToRgb(b)
  return rgbToHex(
    Math.round(c1.r + f * (c2.r - c1.r)),
    Math.round(c1.g + f * (c2.g - c1.g)),
    Math.round(c1.b + f * (c2.b - c1.b))
  )
}
function getSkyColor(hour) {
  for (let i = 0; i < skyColors.length - 1; i++) {
    if (hour >= skyColors[i].time && hour < skyColors[i + 1].time) {
      const { color: c1, time: t1 } = skyColors[i], { color: c2, time: t2 } = skyColors[i + 1]
      return interpolateColor(c1, c2, (hour - t1) / (t2 - t1))
    }
  }
  return skyColors[0].color
}
function getColorTempMatrix(factor) {
  factor = Math.max(-1, Math.min(1, factor))
  const r = 1 + 0.25 * factor, g = 1 + 0.15 * factor, b = 1 - 0.25 * factor
  return `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0`.replace(/\s+/g, ' ').trim()
}
function getClientX(e) {
  if (e.touches && e.touches.length) return e.touches[0].clientX
  if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX
  return e.clientX
}
function getHourFromPos(x, width) {
  const center = width / 2
  const rel = (x - center) / center
  return [12 + rel * 12, rel]
}

// --- SKY & TEMP UPDATES ---
function updateBackgroundColor() {
  const now = new Date(), hour = now.getHours() + now.getMinutes() / 60
  backgroundFill.value = getSkyColor(hour)
}
function updateColorTemperature() {
  const now = new Date(), hour = now.getHours() + now.getMinutes() / 60
  let factor = hour >= 6 && hour <= 15 ? 1 - Math.abs(hour - 12) / 6
    : hour < 6 ? -1 + hour / 6 : -1 + (24 - hour) / 9
  colorTempMatrix.value = getColorTempMatrix(factor)
}
function resetSkyTemp() {
  updateBackgroundColor()
  updateColorTemperature()
}

// --- MOON ROTATION ---
function updateMoonRotation() {
  const days = Math.floor((Date.now() - new Date(2025, 5, 26)) / (1000 * 60 * 60 * 24))
  moonTransform.value = `rotate(${(days / 29.5) * 360}deg)`
}

// --- CAROUSEL LOGIC ---
function startDrag(e) {
  isDragging.value = true
  lastMouseX.value = getClientX(e)
  velocityY.value = 0
  lastTimestamp.value = performance.now()
  useHoverVelocity.value = false
  carouselContainer.value.style.cursor = 'none'
  if (e.preventDefault) e.preventDefault()
}
function dragMove(e) {
  if (!isDragging.value) return
  const dx = getClientX(e) - lastMouseX.value
  rotationY.value += dx
  lastMouseX.value = getClientX(e)
  const now = performance.now(), dt = (now - lastTimestamp.value) / 1000
  velocityY.value = dx / (dt || 1)
  lastTimestamp.value = now
  handleSkyAndTempInteraction(e)
}
function endDrag() {
  isDragging.value = false
  carouselContainer.value.style.cursor = 'default'
}
function handleHover(e) {
  if (isDragging.value) return
  const rect = carouselContainer.value.getBoundingClientRect()
  const x = getClientX(e) - rect.left
  const center = rect.width / 2
  const rel = (x - center) / center
  hoverVelocity.value = rel * maxVelocity
  useHoverVelocity.value = true
  resumeSpinDirection.value = rel < 0 ? -1 : 1
}
function endHover() {
  useHoverVelocity.value = false
}
function handleSkyAndTempInteraction(e) {
  const rect = carouselContainer.value.getBoundingClientRect()
  const x = getClientX(e) - rect.left
  const [hour, rel] = getHourFromPos(x, rect.width)
  backgroundFill.value = getSkyColor(hour)
  if (skyColorTimeout.value) clearTimeout(skyColorTimeout.value)
  skyColorTimeout.value = setTimeout(resetSkyTemp, 5000)

  let factor = Math.max(-1, Math.min(1, rel < 0 ? -1 + (1 + rel) * 2 : 1 - (1 - rel) * 2))
  colorTempMatrix.value = getColorTempMatrix(factor)
  if (colorTempTimeout.value) clearTimeout(colorTempTimeout.value)
  colorTempTimeout.value = setTimeout(updateColorTemperature, 5000)
}
const carouselTransform = computed(() => `translate(-50%, -50%) rotateY(${rotationY.value}deg)`)
function getTextStyle(i) {
  const angle = (360 / itemCount) * i
  return {
    transform: `rotateY(${angle}deg) translateZ(${radius}px) rotateY(${-rotationY.value}deg)`,
    opacity: Math.max(0, Math.cos(((angle + rotationY.value) % 360 + 360) % 360 * Math.PI / 180)).toFixed(2)
  }
}

// --- ANIMATION LOOP ---
let animationFrame
function animate() {
  if (isDragging.value && Math.abs(velocityY.value) > 0.01) {
    rotationY.value += velocityY.value * 0.016
    velocityY.value *= 0.93
    if (Math.abs(velocityY.value) < 0.01) velocityY.value = 0
  } else if (useHoverVelocity.value) {
    rotationY.value += hoverVelocity.value
  } else {
    rotationY.value += minVelocity * resumeSpinDirection.value
  }
  animationFrame = requestAnimationFrame(animate)
}

// --- LIFECYCLE ---
onMounted(() => {
  updateBackgroundColor()
  updateColorTemperature()
  updateMoonRotation()
  setInterval(updateBackgroundColor, 10 * 60 * 1000)
  setInterval(updateColorTemperature, 5 * 60 * 1000)
  animate()

  // Mouse events
  window.addEventListener('mousemove', dragMove)
  window.addEventListener('mouseup', endDrag)
  // Touch events
  window.addEventListener('touchmove', dragMove, { passive: false })
  window.addEventListener('touchend', endDrag)
})
onBeforeUnmount(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  window.removeEventListener('mousemove', dragMove)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', dragMove)
  window.removeEventListener('touchend', endDrag)
})
</script>

<style scoped src="./faestyles.css"></style>