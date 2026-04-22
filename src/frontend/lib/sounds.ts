export type SoundId = 'bell' | 'beep' | 'chime' | 'airhorn' | 'rooster' | 'bear'

export const SOUNDS: { id: SoundId; label: string; emoji: string }[] = [
  { id: 'bell',    label: 'Campana',  emoji: '🔔' },
  { id: 'beep',    label: 'Beep',     emoji: '📟' },
  { id: 'chime',   label: 'Tintín',   emoji: '🎵' },
  { id: 'airhorn', label: 'Bocina',   emoji: '📣' },
  { id: 'rooster', label: 'Gallo',    emoji: '🐓' },
  { id: 'bear',    label: 'Oso',      emoji: '🐻' },
]

// Target de peak para normalización: ~0.42 (igual que bell/chime sintetizados)
const TARGET_PEAK = 0.42

// Cache del AudioBuffer decodificado para no fetch repetido
const bufferCache = new Map<string, AudioBuffer>()

async function getAudioBuffer(url: string): Promise<AudioBuffer> {
  if (bufferCache.has(url)) return bufferCache.get(url)!
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const res = await fetch(url)
  const arr = await res.arrayBuffer()
  const buf = await ctx.decodeAudioData(arr)
  bufferCache.set(url, buf)
  return buf
}

// Calcula el gain necesario para que el peak del buffer llegue a TARGET_PEAK
function peakNormalizedGain(buffer: AudioBuffer): number {
  let peak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > peak) peak = abs
    }
  }
  return peak > 0 ? TARGET_PEAK / peak : 1
}

async function playSampleSound(url: string): Promise<void> {
  try {
    const buffer = await getAudioBuffer(url)
    await new Promise<void>(resolve => {
      const ctx = new AudioContext()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(peakNormalizedGain(buffer), ctx.currentTime)
      source.connect(gain)
      gain.connect(ctx.destination)
      source.start()
      source.onended = () => { ctx.close(); resolve() }
    })
  } catch { /* silencioso */ }
}

export function playSound(id: SoundId): Promise<void> {
  if (id === 'bear')    return playSampleSound('/sounds/bear.ogg')
  if (id === 'rooster') return playSampleSound('/sounds/rooster.ogg')
  if (id === 'airhorn') return playSampleSound('/sounds/airhorn.ogg')

  const ctx = new AudioContext()

  return new Promise<void>(resolve => {
    switch (id) {
      case 'bell': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.45, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
        osc.start(); osc.stop(ctx.currentTime + 1.5)
        osc.onended = () => { ctx.close(); resolve() }
        break
      }
      case 'beep': {
        let lastOsc: OscillatorNode | null = null
        for (let i = 0; i < 3; i++) {
          const t = ctx.currentTime + i * 0.22
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'square'
          osc.frequency.setValueAtTime(1000, t)
          gain.gain.setValueAtTime(0.12, t)
          gain.gain.setValueAtTime(0, t + 0.12)
          osc.start(t); osc.stop(t + 0.12)
          lastOsc = osc
        }
        lastOsc!.onended = () => { ctx.close(); resolve() }
        break
      }
      case 'chime': {
        const freqs = [523, 659, 784]
        let lastOsc: OscillatorNode | null = null
        freqs.forEach((freq, i) => {
          const t = ctx.currentTime + i * 0.28
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, t)
          gain.gain.setValueAtTime(0.4, t)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
          osc.start(t); osc.stop(t + 0.9)
          lastOsc = osc
        })
        lastOsc!.onended = () => { ctx.close(); resolve() }
        break
      }
      default:
        ctx.close(); resolve()
    }
  })
}
