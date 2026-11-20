import { useCallback, useEffect, useRef, useState } from 'react'
import rainUrl from './audio/dragon-studio-relaxing-rain-sounds-437312.mp3'
import thunderUrl from './audio/dragon-studio-dry-thunder-364468.mp3'

const recordings = { rain: rainUrl, thunder: thunderUrl }

function snowWind(context) {
  const rate = 12000
  const buffer = context.createBuffer(2, rate * 56, rate)
  const left = buffer.getChannelData(0)
  const right = buffer.getChannelData(1)
  // Short breezes with open space between them. The first and last samples are silent.
  let start = 0
  while (start < buffer.length - rate) {
    const length = Math.min(Math.round(rate * (5 + Math.random() * 5)), buffer.length - start)
    const warmth = .14 + Math.random() * .06
    const strength = .50 + Math.random() * .35
    const pan = .44 + Math.random() * .12
    let air = 0, soft = 0, bass = 0
    for (let i = 0; i < length; i++) {
      air += warmth * (Math.random() * 2 - 1 - air)
      soft += warmth * (air - soft)
      bass += .045 * (soft - bass)
      const envelope = Math.sin(Math.PI * i / (length - 1)) ** 2
      const sample = (soft - bass) * strength * envelope
      left[start + i] = sample * (1 - pan)
      right[start + i] = sample * pan
    }
    start += length + Math.round(rate * (1 + Math.random() * 3))
  }
  return buffer
}

function createAmbience(onError) {
  const context = new AudioContext({ sampleRate: 24000 })
  const controller = new AbortController()
  const tracks = new Map()
  async function start(track, name) {
    try {
      if (!track.buffer) {
        if (name === 'snow') track.buffer = snowWind(context)
        else {
          const response = await fetch(recordings[name], { signal: controller.signal })
          if (!response.ok) throw new Error()
          track.buffer = await context.decodeAudioData(await response.arrayBuffer())
        }
      }
      if (controller.signal.aborted || !track.level) return
      const source = context.createBufferSource()
      source.buffer = track.buffer
      source.loop = true
      source.connect(track.gain)
      track.gain.gain.cancelScheduledValues(context.currentTime)
      track.gain.gain.setValueAtTime(0, context.currentTime)
      track.gain.gain.setTargetAtTime(track.level, context.currentTime, .35)
      source.start()
      track.source = source
    } catch {
      if (!controller.signal.aborted && track.level) onError()
    } finally {
      track.loading = false
    }
  }
  function level(name, volume) {
    let track = tracks.get(name)
    if (!track) {
      if (!volume) return
      const gain = context.createGain()
      gain.gain.value = 0
      gain.connect(context.destination)
      track = { gain, level: 0 }
      tracks.set(name, track)
    }
    if (track.level === volume) return
    track.level = volume
    clearTimeout(track.stopTimer)
    if (track.source) {
      track.gain.gain.setTargetAtTime(volume, context.currentTime, .25)
      if (!volume) track.stopTimer = setTimeout(() => {
        track.source.stop()
        track.source.disconnect()
        track.source = null
      }, 1500)
    } else if (volume && !track.loading) {
      track.loading = true
      start(track, name)
    }
  }
  return {
    context, level,
    close() {
      controller.abort()
      for (const track of tracks.values()) clearTimeout(track.stopTimer)
      context.close()
    },
  }
}

export function useWeatherSound() {
  const engine = useRef(null)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const setIntensity = useCallback((rain, storm, snow) => {
    const player = engine.current
    if (!player) return
    player.level('rain', enabled ? .53 * rain : 0)
    player.level('thunder', enabled ? .36 * storm : 0)
    player.level('snow', enabled ? .12 * snow : 0)
  }, [enabled])
  useEffect(() => () => { engine.current?.close() }, [])
  function failed() {
    setEnabled(false)
    setError('Não foi possível reproduzir o som. Tente novamente.')
  }
  async function toggle() {
    try {
      if (!engine.current) engine.current = createAmbience(failed)
      await engine.current.context.resume()
      setEnabled(value => !value)
      setError('')
    } catch { failed() }
  }
  return { enabled, toggle, error, setIntensity }
}
