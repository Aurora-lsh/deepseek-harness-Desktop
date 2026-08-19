const { ipcRenderer } = require('electron')

let lastRunning
let scheduled = false

function reportsGeneration(element) {
  const label = [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-testid'),
  ].filter(Boolean).join(' ').toLowerCase()
  return /停止生成|停止回答|stop generating|stop response|stop-generation|stop_button/.test(label)
}

function inspectGenerationState() {
  scheduled = false
  const running = [...document.querySelectorAll('button, [role="button"]')].some(reportsGeneration)
  if (running === lastRunning) return
  lastRunning = running
  ipcRenderer.send('dsh-desktop:chat-generation', running)
}

function scheduleInspection() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(inspectGenerationState)
}

window.addEventListener('DOMContentLoaded', () => {
  new MutationObserver(scheduleInspection).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'data-testid', 'disabled'],
  })
  scheduleInspection()
})
