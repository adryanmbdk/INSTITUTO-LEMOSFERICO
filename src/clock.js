export const skies = [
  { id: 'dawn', label: 'Amanhecer', color: '#dab379' },
  { id: 'day', label: 'Dia', color: '#a9b894' },
  { id: 'sunset', label: 'Entardecer', color: '#c57d57' },
  { id: 'twilight', label: 'Crepúsculo', color: '#927e9e' },
  { id: 'night', label: 'Noite', color: '#4f6482' },
  { id: 'late', label: 'Madrugada', color: '#778b95' },
]

export const weatherOptions = [
  { id: 'clear', label: 'Céu limpo' },
  { id: 'cloudy', label: 'Nublado' },
  { id: 'fog', label: 'Neblina' },
  { id: 'rain', label: 'Chuva' },
  { id: 'storm', label: 'Tempestade' },
  { id: 'snow', label: 'Neve' },
]

export const initialCycle = {
  total: 3600,
  mode: 'manual',
  startId: 'sunset',
  sections: skies.map(({ id, label }, index) => ({
    id, name: label, sky: id,
    weather: ['fog', 'clear', 'clear', 'cloudy', 'rain', 'clear'][index],
    duration: [300, 1200, 600, 300, 900, 300][index],
  })),
}

const storageKey = 'relogio-lemos-cycle-v1'

export function durationsFor(cycle) {
  if (cycle.mode === 'manual') return cycle.sections.map(section => section.duration)
  const count = cycle.sections.length
  const whole = Math.floor(cycle.total / count)
  const extra = cycle.total % count
  return cycle.sections.map((_, index) => whole + Number(index < extra))
}

export function withCycleTotal(cycle) {
  if (cycle.mode !== 'manual') return cycle
  return { ...cycle, total: cycle.sections.reduce((sum, section) => sum + section.duration, 0) }
}

export function validateCycle(cycle) {
  if (!Number.isSafeInteger(cycle.total) || cycle.total < 1) return 'Informe uma duração total maior que zero.'
  if (!cycle.sections.length) return 'Adicione pelo menos uma seção.'
  if (!cycle.sections.some(section => section.id === cycle.startId)) return 'Escolha a seção inicial.'
  if (cycle.sections.some(section => !section.name.trim())) return 'Dê um nome a todas as seções.'
  const durations = durationsFor(cycle)
  if (durations.some(duration => !Number.isSafeInteger(duration) || duration < 1)) return 'Cada seção precisa durar pelo menos um segundo.'
  return ''
}

export function readCycle() {
  try {
    const cycle = JSON.parse(localStorage.getItem(storageKey))
    if (cycle) {
      const normalized = withCycleTotal(cycle)
      if (!validateCycle(normalized)) return normalized
    }
  } catch {
    // The built-in cycle is available when storage is blocked or invalid.
  }
  return initialCycle
}

export function saveCycle(cycle) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cycle))
    return true
  } catch {
    return false
  }
}

export function scheduleFor(cycle) {
  const durations = durationsFor(cycle)
  let start = 0
  return cycle.sections.map((section, index) => {
    const duration = durations[index] * 1000
    const entry = { ...section, start, end: start + duration, duration }
    start = entry.end
    return entry
  })
}

export function positionAt(clock, now, total) {
  const delta = clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt)
  return (clock.offset + delta) % total
}

export function untilNextStart(start, position, total) {
  return start > position ? start - position : total - position + start
}

export function durationText(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  return [hours && hours + ' h', minutes && minutes + ' min', (seconds % 60 || !seconds) ? seconds % 60 + ' s' : ''].filter(Boolean).join(' ')
}

const hourFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function timeText(time) {
  return hourFormatter.format(time)
}
