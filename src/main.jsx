import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { durationText, durationsFor, positionAt, readCycle, saveCycle, scheduleFor, skies, timeText, untilNextStart, validateCycle, withCycleTotal, weatherOptions } from './clock'
import { drawLandscape, precipitation, weatherAt } from './landscape'
import { useWeatherSound } from './rain'
import './style.css'

const paths = {
  storm: 'M5 14a4 4 0 0 1 1-7 6 6 0 0 1 11 1 4 4 0 0 1 1 7m-6-4-4 6h4l-2 5 7-9h-5Z',
  snow: 'M12 2v20M3.4 7l17.2 10M3.4 17 20.6 7M9 4l3 3 3-3m-6 16 3-3 3 3',
  compass: 'M12 2v3m0 14v3M2 12h3m14 0h3M15 9l-1.5 4.5L9 15l1.5-4.5L15 9Z M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  expand: 'M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4',
  play: 'm9 5 11 7-11 7V5Z',
  pause: 'M9 5H7v14h2zM17 5h-2v14h2z',
  next: 'm5 5 10 7-10 7V5Zm14 0v14',
  reset: 'M3 12a9 9 0 1 1 2.5 6.2M3 4v8h8',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5m-2 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  cloud: 'M6 18a4 4 0 1 1 .6-8A6 6 0 0 1 18 11a3.5 3.5 0 1 1 .5 7Z',
  fog: 'M3 9h18M5 13h14M3 17h18',
  rain: 'M6 15a4 4 0 1 1 .6-8A6 6 0 0 1 18 8a3.5 3.5 0 1 1 .5 7ZM9 18l-1 3m6-3-1 3m6-3-1 3',
  adjust: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  left: 'm13 6-6 6 6 6',
  right: 'm9 6 6 6-6 6',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  close: 'm6 6 12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  remove: 'M4 7h16m-11 0V4h6v3m3 0-1 13H7L6 7m4 3v7m4-7v7',
}

function Icon({ name, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}

function Landscape({ section, clock, total, moon, presenting, onExit, onWeather }) {
  const canvasRef = useRef(null)
  const transition = useRef({})
  const weatherName = weatherOptions.find(option => option.id === section.weather)?.label
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false })
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let width, height, frame, last = -Infinity
    function paint(t) {
      const position = positionAt(clock, Date.now(), total)
      const progress = Math.max(0, Math.min(1, (position - section.start) / section.duration))
      const weights = weatherAt(transition.current, section.weather, t)
      onWeather(precipitation(weights.rain + weights.storm), precipitation(weights.storm), precipitation(weights.snow))
      drawLandscape(ctx, section, progress, width, height, reduced.matches ? 0 : t / 1000, moon, weights)
    }
    function resize() {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const scale = Math.min(2, devicePixelRatio)
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      if (width && height) paint(performance.now())
    }
    function tick(t) {
      if (width && height && t - last >= (reduced.matches ? 1000 : 32)) {
        paint(t)
        last = t
      }
      frame = requestAnimationFrame(tick)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [section, clock, total, moon, onWeather])
  return (
    <section className={presenting ? 'vista is-presenting' : 'vista'} aria-label="Paisagem do ciclo">
      <canvas ref={canvasRef} className="vista-art" role="img" aria-label={'Paisagem de ' + section.name.toLowerCase() + ' com ' + weatherName?.toLowerCase()} />
      {presenting && <button className="exit-presentation" onClick={onExit} autoFocus><Icon name="close" /> Sair da apresentação</button>}
    </section>
  )
}

function DurationInput({ label, value, onChange }) {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return (
    <div className="field" role="group" aria-label={label}>
      {label}
      <span className="duration-field">
        <label><input type="number" min="0" step="1" aria-label={label + ' em minutos'} value={minutes} onChange={event => onChange(Number(event.target.value) * 60 + seconds)} /><span>min</span></label>
        <label><input type="number" min="0" max="59" step="1" aria-label={label + ' em segundos'} value={seconds} onChange={event => {
          const next = Number(event.target.value)
          if (Number.isInteger(next) && next >= 0 && next < 60) onChange(minutes * 60 + next)
        }} /><span>s</span></label>
      </span>
    </div>
  )
}

function CycleEditor({ cycle, sessionStarted, onClose, onSave }) {
  const [draft, setDraft] = useState(cycle)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const settingsRef = useRef(null)
  const dialogRef = useRef(null)
  const durations = durationsFor(draft)
  useEffect(() => { dialogRef.current.showModal() }, [])

  function update(patch) {
    setDraft(current => withCycleTotal({ ...current, ...patch }))
    setError('')
  }
  function setSection(id, patch) {
    update({ sections: draft.sections.map(section => section.id === id ? { ...section, ...patch } : section) })
  }
  function move(index, delta) {
    const sections = [...draft.sections]
    const [section] = sections.splice(index, 1)
    sections.splice(index + delta, 0, section)
    update({ sections })
  }
  function remove(id) {
    const sections = draft.sections.filter(section => section.id !== id)
    update({ sections, startId: id === draft.startId ? sections[0].id : draft.startId })
  }
  function add() {
    const id = crypto.randomUUID()
    setExpanded(id)
    update({ sections: [...draft.sections, { id, name: '', duration: 60, sky: 'day', weather: 'clear' }] })
  }
  function save(event) {
    event.preventDefault()
    const normalized = { ...draft, sections: draft.sections.map((section, index) => ({
      ...section, name: section.name.trim(), duration: durations[index],
    })) }
    const message = validateCycle(normalized)
    if (message) {
      setError(message)
      const invalid = normalized.sections.find(section => !section.name || (draft.mode === 'manual' && section.duration < 1))
      if (invalid) setExpanded(invalid.id)
      else settingsRef.current.open = true
    } else onSave(normalized)
  }

  return (
    <dialog ref={dialogRef} className="editor" aria-labelledby="editor-title" onCancel={onClose}>
      <form onSubmit={save} noValidate>
        <header className="editor-header"><div><h2 id="editor-title">Editar ciclo</h2><p className="cycle-summary">{draft.sections.length} {draft.sections.length === 1 ? 'seção' : 'seções'} · {durationText(draft.total * 1000)} no total</p></div><button type="button" className="icon-button" aria-label="Fechar editor" onClick={onClose}><Icon name="close" /></button></header>
        <div className="editor-body">
          <details className="cycle-options" ref={settingsRef}>
            <summary>Ajustes do ciclo <Icon name="down" size={16} /></summary>
          <div className="editor-settings">
            {draft.mode === 'manual'
              ? <label className="field">Duração total das seções<output className="readout">{durationText(draft.total * 1000)}</output></label>
              : <DurationInput label="Duração total" value={draft.total} onChange={total => update({ total })} />}
            <label className="field">Distribuição do tempo<select value={draft.mode} onChange={event => update({
              mode: event.target.value,
              sections: draft.sections.map((section, index) => ({ ...section, duration: durations[index] })),
            })}><option value="manual">Por seção</option><option value="equal">Dividir igualmente</option></select></label>
            <label className="field start-field">Começar em<select value={draft.startId} onChange={event => update({ startId: event.target.value })}>{draft.sections.map((section, index) => <option key={section.id} value={section.id}>{section.name || 'Seção ' + (index + 1)}</option>)}</select></label>
          </div>
          </details>
          <div className="editor-section-heading"><h3>Seções</h3><button type="button" className="add-section" onClick={add}><Icon name="plus" size={15} /> Adicionar seção</button></div>
          <ol className="editor-list">
            {draft.sections.map((section, index) => (
              <li key={section.id} className={expanded === section.id ? 'expanded' : ''}>
                <button type="button" className="section-summary" aria-expanded={expanded === section.id} onClick={() => setExpanded(expanded === section.id ? null : section.id)}>
                  <i aria-hidden="true" style={{ backgroundColor: skies.find(sky => sky.id === section.sky)?.color }} />
                  <strong>{section.name || 'Nova seção'}</strong>
                  <span>{durationText(durations[index] * 1000)}</span><Icon name={expanded === section.id ? 'up' : 'down'} size={15} />
                </button>
                {expanded === section.id && <fieldset>
                  <legend className="sr-only">Editar {section.name || 'nova seção'}</legend>
                  <div className="section-fields">
                    <label className="field">Nome<input autoFocus={!section.name} maxLength="60" value={section.name} onChange={event => setSection(section.id, { name: event.target.value })} /></label>
                    {draft.mode === 'manual' ? <DurationInput label="Duração" value={section.duration} onChange={duration => setSection(section.id, { duration })} /> : <div className="field">Duração<span className="readout">{durationText(durations[index] * 1000)}</span></div>}
                    <label className="field">Aparência<select value={section.sky} onChange={event => setSection(section.id, { sky: event.target.value })}>{skies.map(sky => <option key={sky.id} value={sky.id}>{sky.label}</option>)}</select></label>
                    <label className="field">Clima<select value={section.weather} onChange={event => setSection(section.id, { weather: event.target.value })}>{weatherOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                  </div>
                  <div className="section-actions">
                    <button type="button" className="icon-button" aria-label={'Subir seção ' + (index + 1)} disabled={index === 0} onClick={() => move(index, -1)}><Icon name="up" /></button>
                    <button type="button" className="icon-button" aria-label={'Descer seção ' + (index + 1)} disabled={index === draft.sections.length - 1} onClick={() => move(index, 1)}><Icon name="down" /></button>
                    <button type="button" className="icon-button" aria-label={'Remover seção ' + (index + 1)} disabled={draft.sections.length === 1} onClick={() => remove(section.id)}><Icon name="remove" /></button>
                  </div>
                </fieldset>}
              </li>
            ))}
          </ol>
        </div>
        <footer className="editor-footer">
          <p role={error ? 'alert' : undefined}>{error || (sessionStarted ? 'Salvar retorna o relógio à seção inicial.' : '')}</p>
          <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button primary">Salvar ciclo</button>
        </footer>
      </form>
    </dialog>
  )
}

function clockAtStart(cycle) {
  return {
    offset: scheduleFor(cycle).find(section => section.id === cycle.startId).start,
    startedAt: null,
    used: false,
  }
}

function App() {
  const [cycle, setCycle] = useState(readCycle)
  const [clock, setClock] = useState(() => clockAtStart(cycle))
  const [now, setNow] = useState(Date.now)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const presentButton = useRef(null)
  const sections = useMemo(() => scheduleFor(cycle), [cycle])
  const total = cycle.total * 1000
  const running = clock.startedAt !== null
  const position = positionAt(clock, now, total)
  const currentIndex = sections.findIndex(section => position < section.end)
  const current = sections[currentIndex]
  const next = sections[(currentIndex + 1) % sections.length]
  const selected = sections.find(section => section.id === selectedId)
  const sound = useWeatherSound()
  const moon = cycle.moon || 'full'
  const left = current.end - position
  const selectedCountdown = selected ? untilNextStart(selected.start, position, total) : 0
  const startsHere = !clock.used && selected?.start === position
  const canPresentFullScreen = typeof document.documentElement.requestFullscreen === 'function'

  useEffect(() => {
    if (!running) return
    const update = () => setNow(Date.now())
    const interval = window.setInterval(update, 200)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
    }
  }, [running])

  useEffect(() => {
    if (!presenting) return
    const onKey = event => { if (event.key === 'Escape') closePresentation() }
    const onFullscreen = () => { if (!document.fullscreenElement) closePresentation() }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [presenting])

  function changeCycle(value) {
    setCycle(value)
    setStorageError(!saveCycle(value))
  }
  function applyCycle(value) {
    changeCycle(value)
    setClock(clockAtStart(value))
    setSelectedId(null)
    setEditing(false)
  }
  function toggleClock() {
    const timestamp = Date.now()
    setNow(timestamp)
    if (running) setClock({ offset: positionAt(clock, timestamp, total), startedAt: null, used: true })
    else setClock({ ...clock, startedAt: timestamp, used: true })
  }
  function jump(section) { seek(section.start) }
  function seek(offset) {
    const timestamp = Date.now()
    setNow(timestamp)
    setClock({ ...clock, offset, startedAt: running ? timestamp : null })
  }
  function advance() {
    const positionNow = positionAt(clock, Date.now(), total)
    const index = sections.findIndex(section => positionNow < section.end)
    jump(sections[(index + 1) % sections.length])
  }
  function reset() {
    const timestamp = Date.now()
    setNow(timestamp)
    setClock({ ...clockAtStart(cycle), startedAt: running ? timestamp : null, used: running })
  }
  function setWeather(weather) {
    const positionNow = positionAt(clock, Date.now(), total)
    const active = sections.find(section => positionNow < section.end)
    changeCycle({ ...cycle, sections: cycle.sections.map(section => section.id === active.id ? { ...section, weather } : section) })
  }
  async function openPresentation() {
    setPresenting(true)
    if (canPresentFullScreen) {
      try { await document.documentElement.requestFullscreen() } catch { /* The in-page view is still available. */ }
    }
  }
  function closePresentation() {
    setPresenting(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    requestAnimationFrame(() => presentButton.current?.focus())
  }

  const soundLabel = { rain: 'Som da chuva', storm: 'Som da tempestade', snow: 'Som da neve' }[current.weather]
  const weatherIcon = { clear: 'sun', cloudy: 'cloud', fog: 'fog', rain: 'rain', storm: 'storm', snow: 'snow' }[current.weather]

  return (
    <main className="shell">
      <header className="site-header" hidden={presenting}>
        <div className="wordmark"><span className="brand-mark"><Icon name="compass" size={21} /></span><h1>Relógio Lemos</h1></div>
        <button ref={presentButton} className="button secondary present-button" onClick={openPresentation}><Icon name="expand" /> Apresentar</button>
      </header>

      <div className="dashboard">
        <Landscape section={current} moon={moon} total={total} clock={clock} presenting={presenting} onExit={closePresentation} onWeather={sound.setIntensity} />
        <aside className="session" hidden={presenting} aria-label="Painel do mestre">
          <div className="session-header">
            <span className={'status' + (running ? ' active' : '')}><span />{running ? 'Em andamento' : clock.used ? 'Em pausa' : 'Pronto para iniciar'}</span>
            <h2>{current.name}</h2>
            <label className="weather-picker">
              <Icon name={weatherIcon} size={17} />
              <select aria-label="Clima da seção atual" value={current.weather} onChange={event => setWeather(event.target.value)}>{weatherOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
              <Icon name="down" size={14} />
            </label>
            <div className="ambience">
              <label>Lua<select value={moon} onChange={event => changeCycle({ ...cycle, moon: event.target.value })}>
                <option value="full">Cheia</option><option value="waxing">Crescente</option>
                <option value="waning">Minguante</option><option value="new">Nova</option>
              </select></label>
              {soundLabel && <button className="sound" aria-pressed={sound.enabled} onClick={sound.toggle}>{soundLabel} · {sound.enabled ? 'ligado' : 'desligado'}</button>}
              {soundLabel && sound.error && <small role="alert">{sound.error}</small>}
            </div>
          </div>
          <div className="transition">
            <div className="transition-title"><span>Próxima seção</span><span>{running ? 'às ' + timeText(now + left) : 'Em ' + durationText(left)}</span></div>
            <p>{next.name}</p>
            {running && <span className="transition-detail">Em {durationText(left)}</span>}
          </div>
          <div className="controls">
            <button className="button primary" onClick={toggleClock}><Icon name={running ? 'pause' : 'play'} />{running ? 'Pausar' : clock.used ? 'Retomar' : 'Iniciar ciclo'}</button>
            <button className="icon-button secondary" title="Avançar seção" aria-label="Avançar seção" onClick={advance}><Icon name="next" /></button>
            <button className="icon-button secondary" title="Reiniciar ciclo" aria-label="Reiniciar ciclo" onClick={reset}><Icon name="reset" /></button>
          </div>
        </aside>
      </div>

      <section className="timeline" hidden={presenting} aria-labelledby="timeline-title">
        <div className="timeline-header">
          <div className="timeline-title"><h2 id="timeline-title">Linha do tempo</h2><span>{durationText(total)} por ciclo</span></div>
          <button className="button secondary" onClick={() => setEditing(true)}><Icon name="adjust" /> Editar ciclo</button>
        </div>
        <label className="scrubber">
          <span>Posição no ciclo <output>{durationText(Math.floor(position / 1000) * 1000)}</output></span>
          <input type="range" aria-label="Posição no ciclo" aria-valuetext={current.name + ', ' + durationText(Math.floor(position / 1000) * 1000)} min="0" max={cycle.total - 1} step="1" value={Math.floor(position / 1000)} onChange={event => seek(Number(event.target.value) * 1000)} />
        </label>
        <div className="timeline-scroll">
          <div className="track" style={{ '--track-width': sections.length * 91 + 'px' }}>
            {sections.map(section => {
              const isCurrent = current.id === section.id
              const progress = isCurrent ? (position - section.start) / section.duration * 100 : 0
              return (
                <button key={section.id} className={'segment' + (isCurrent ? ' current' : '')} aria-current={isCurrent ? 'step' : undefined} aria-pressed={selectedId === section.id} onClick={() => setSelectedId(selectedId === section.id ? null : section.id)} style={{ '--flex': section.duration / total, '--phase-color': skies.find(sky => sky.id === section.sky)?.color, '--phase-progress': progress + '%' }}>
                  <span className="segment-color" /><span className="segment-name">{section.name}</span><span className="segment-duration">{durationText(section.duration)}</span>
                </button>
              )
            })}
          </div>
        </div>
        {selected && (
          <div className="selection">
            <p><strong>{selected.name}</strong><span>{startsHere ? 'Começa junto com o ciclo' : <>{clock.used ? 'Próximo início' : 'Depois de iniciar'} em {durationText(selectedCountdown)}{running && ', às ' + timeText(now + selectedCountdown)}</>}</span></p>
            <button className="button secondary" onClick={() => jump(selected)}>Ir para esta seção <Icon name="right" size={15} /></button>
          </div>
        )}
        {storageError && <p className="storage-warning" role="status">O navegador não conseguiu salvar o ciclo para a próxima visita.</p>}
      </section>
      {editing && <CycleEditor cycle={cycle} sessionStarted={clock.used} onClose={() => setEditing(false)} onSave={applyCycle} />}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
