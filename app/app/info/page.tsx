'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useMemo, useState } from 'react'

// ───────────── parser „czystego tekstu” → struktura osi czasu ─────────────
type ParsedItem = { time: string; title: string; bullets: string[] }
type Parsed = { date: Date | null; dateText: string | null; location: string | null; items: ParsedItem[] }

function parseInfo(text: string): Parsed {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

  // 1) Spróbuj wyłuskać datę + miejscowość z pierwszej linijki (np. „Wesele 12.09.2025r w Szczyrku”)
  let date: Date | null = null
  let dateText: string | null = null
  let location: string | null = null
  if (lines.length) {
    const m = lines[0].match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/i)
    if (m) {
      const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3])
      date = new Date(y, mo, d)
      dateText = date.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    const loc = lines[0].match(/\bw\s+(.+)$/i)
    if (loc) location = loc[1].replace(/\br\.?$/i, '').trim()
  }

  // 2) Sekcje czasu: „HH:MM - Tytuł”, pod nimi wypunktowania „- … / • …”
  const items: ParsedItem[] = []
  let current: ParsedItem | null = null
  for (const raw of lines) {
    const t = raw.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(.+)$/) // HH:MM - opis
    const b = raw.match(/^[-•]\s*(.+)$/)                   // wypunktowanie
    if (t) {
      current = { time: t[1], title: t[2].trim(), bullets: [] }
      items.push(current)
      continue
    }
    if (b && current) {
      current.bullets.push(b[1].trim())
      continue
    }
  }
  return { date, dateText, location, items }
}

// ───────────── prosty eksport do kalendarza (.ics) ─────────────
function buildICS(parsed: Parsed, calendarTitle = 'Plan dnia') {
  if (!parsed.date || !parsed.items.length) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding App//PL',
    `X-WR-CALNAME:${calendarTitle}`,
  ]

  for (const it of parsed.items) {
    // czas startu = data z parsera + HH:MM; czas końca = +45min (domyślnie)
    const [hh, mm] = it.time.split(':').map(Number)
    const start = new Date(parsed.date)
    start.setHours(hh || 0, mm || 0, 0, 0)
    const end = new Date(start.getTime() + 45 * 60 * 1000)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${crypto.randomUUID()}@wedding-app`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${it.title.replace(/[\r\n]/g, ' ')}`,
      parsed.location ? `LOCATION:${parsed.location}` : `LOCATION:`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
}

// ───────────── pojedynczy „kafelek” osi czasu ─────────────
function TimelineItem({ it }: { it: ParsedItem }) {
  return (
    <li className="mb-6 ms-4 reveal-up">
      <span className="absolute -start-2 top-2 size-4 rounded-full bg-amber-400 ring-4 ring-amber-100 shadow" />
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-semibold text-amber-700 tabular-nums">{it.time}</span>
        <h3 className="font-semibold">{it.title}</h3>
      </div>
      {it.bullets.length > 0 && (
        <ul className="mt-1 text-sm text-slate-700 list-disc ps-6">
          {it.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
    </li>
  )
}

export default function InfoPage() {
  const supabase = supaClient()
  const [title, setTitle] = useState('Najważniejsze informacje')
  const [content, setContent] = useState('')
  const [wid, setWid] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // parse + animacje na wejściu
  const parsed = useMemo(() => parseInfo(content), [content])
  const hasTimeline = parsed.items.length > 0

  useEffect(() => {
    ;(async () => {
      const myWid = await getMyWeddingId()
      setWid(myWid)

      const { data: page } = await supabase
        .from('info_pages')
        .select('*')
        .eq('wedding_id', myWid)
        .maybeSingle()

      if (page) {
        setTitle(page.title ?? title)
        setContent(page.content ?? '')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('guests')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
        setIsOrganizer(data?.role === 'organizer')
      }

      setLoading(false)
    })().catch(e => { setErr(String(e)); setLoading(false) })
  }, [])

  // lazy „reveal-up” na scrollu
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal-up'))
    if (!els.length) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add('visible')
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.15 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [content])

  async function save() {
    if (!wid) { alert('Brak powiązania z weselem.'); return }
    const { error } = await supabase
      .from('info_pages')
      .upsert({ wedding_id: wid, title, content }, { onConflict: 'wedding_id' })
    if (error) alert(error.message)
    else alert('Zapisano')
  }

  function downloadICS() {
    const blob = buildICS(parsed, title || 'Plan dnia')
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wesele-plan.ics'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 0)
  }

  if (loading) return <p>Ładowanie…</p>

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK z gradientem i lekkim shine */}
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold gradient-title shimmer">{title}</h1>
        {(parsed.dateText || parsed.location) && (
          <p className="text-slate-600">
            {parsed.dateText ? `🗓️ ${parsed.dateText}` : ''}{parsed.dateText && parsed.location ? ' • ' : ''}
            {parsed.location ? `📍 ${parsed.location}` : ''}
          </p>
        )}
        <div className="gold-hr mt-2" />
      </header>

      {/* ORGANIZATOR: edycja + żywy podgląd poniżej */}
      {isOrganizer && (
        <div className="space-y-3 lift">
          <input
            className="border p-2 rounded w-full"
            value={title}
            onChange={e=>setTitle(e.target.value)}
            placeholder="Nagłówek sekcji"
          />
          <textarea
            className="border p-2 rounded w-full h-40"
            value={content}
            onChange={e=>setContent(e.target.value)}
            placeholder="Wklej tu treść (np. harmonogram w formacie HH:MM - ...)"
          />
          <div className="flex gap-2">
            <button className="btn" onClick={save}>Zapisz</button>
            {hasTimeline && <button className="btn" onClick={downloadICS}>Dodaj do kalendarza (.ics)</button>}
          </div>
        </div>
      )}

      {/* PODGLĄD (dla wszystkich). Gdy parser rozpozna format – pokazujemy oś czasu. */}
      <section className="space-y-4">
        {hasTimeline ? (
          <>
            <ol className="relative ms-2 border-s border-amber-200">
              {parsed.items.map((it, i) => <TimelineItem key={i} it={it} />)}
            </ol>
            <div className="flex gap-2">
              {hasTimeline && <button className="btn" onClick={downloadICS}>Dodaj do kalendarza (.ics)</button>}
            </div>
          </>
        ) : (
          <div className="prose whitespace-pre-wrap">{content || 'Brak treści'}</div>
        )}
      </section>

      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
