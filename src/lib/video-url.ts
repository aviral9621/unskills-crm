export type VideoProvider = 'youtube' | 'vimeo' | 'other'

export interface ParsedVideo {
  provider: VideoProvider
  id: string | null
  embedUrl: string | null
  thumbnailUrl: string | null
  originalUrl: string
}

export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id || null
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'v') {
        return parts[1] || null
      }
    }
    return null
  } catch {
    return null
  }
}

export function getVimeoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.replace(/^www\./, '').endsWith('vimeo.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    const id = parts.find(p => /^\d+$/.test(p))
    return id || null
  } catch {
    return null
  }
}

export function parseVideoUrl(url: string): ParsedVideo {
  const trimmed = (url || '').trim()
  const yt = getYouTubeId(trimmed)
  if (yt) {
    return {
      provider: 'youtube',
      id: yt,
      embedUrl: `https://www.youtube.com/embed/${yt}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
      originalUrl: trimmed,
    }
  }
  const vm = getVimeoId(trimmed)
  if (vm) {
    return {
      provider: 'vimeo',
      id: vm,
      embedUrl: `https://player.vimeo.com/video/${vm}`,
      thumbnailUrl: null,
      originalUrl: trimmed,
    }
  }
  return {
    provider: 'other',
    id: null,
    embedUrl: null,
    thumbnailUrl: null,
    originalUrl: trimmed,
  }
}

export function isProbablyUrl(s: string): boolean {
  try {
    const u = new URL(s.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
