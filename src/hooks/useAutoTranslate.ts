import { useEffect, useRef, useState } from 'react'

// MyMemory free translation endpoint — no auth needed for low volume.
// 5000 chars/day anonymous, 50000 with email. Safe for occasional question-form use.
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'

export type TranslateLang = 'en' | 'hi'

// Detect Hindi (Devanagari) vs English by checking for Devanagari unicode range.
export function detectLang(text: string): TranslateLang {
  return /[ऀ-ॿ]/.test(text) ? 'hi' : 'en'
}

export async function translateText(
  text: string,
  from: TranslateLang,
  to: TranslateLang,
): Promise<string | null> {
  if (!text.trim() || from === to) return null
  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text.trim())}&langpair=${from}|${to}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const translated = json?.responseData?.translatedText
    if (typeof translated !== 'string' || !translated.trim()) return null
    // MyMemory sometimes echoes back the original on quota exceeded — ignore that.
    if (translated.trim().toLowerCase() === text.trim().toLowerCase()) return null
    // Filter out their error sentinel strings.
    if (/QUERY LENGTH LIMIT|MYMEMORY WARNING|INVALID/i.test(translated)) return null
    return translated
  } catch {
    return null
  }
}

/**
 * Bidirectional auto-translation between two text fields (e.g., EN ↔ HI question text).
 *
 * Behaviour:
 *  - Debounces user typing for `delayMs` (default 700ms)
 *  - Only fills the target field when it is *empty* — never overwrites manual edits
 *  - Tracks which field the user last typed in to avoid feedback loops
 *  - Returns a `translating` flag and a `notify` function to call from each field's onChange
 */
export function useBidirectionalAutoTranslate(opts: {
  enText: string
  hiText: string
  setEnText: (v: string) => void
  setHiText: (v: string) => void
  delayMs?: number
  enabled?: boolean
}) {
  const { enText, hiText, setEnText, setHiText, delayMs = 700, enabled = true } = opts
  const [translating, setTranslating] = useState(false)

  const lastSourceRef = useRef<TranslateLang | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel pending translation if either input changes again (re-trigger)
  useEffect(() => {
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)

    const source = lastSourceRef.current
    if (!source) return

    const sourceText = source === 'en' ? enText : hiText
    const targetText = source === 'en' ? hiText : enText
    if (!sourceText.trim()) return
    if (targetText.trim()) return // don't overwrite user content

    timerRef.current = setTimeout(async () => {
      setTranslating(true)
      try {
        const out = await translateText(sourceText, source, source === 'en' ? 'hi' : 'en')
        if (!out) return
        // Set only if target is still empty when translation completes
        if (source === 'en') {
          setHiText(out)
        } else {
          setEnText(out)
        }
      } finally {
        setTranslating(false)
      }
    }, delayMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enText, hiText, enabled])

  // Call from onChange to mark which field the user typed in
  function notifyTyping(lang: TranslateLang) {
    lastSourceRef.current = lang
  }

  return { translating, notifyTyping }
}
