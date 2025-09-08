'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supaClient } from '@/lib/supabaseClient'

type WidOpt = { id: string; label: string }

export default function DjLoginPage() {
  const supabase = supaClient()
  const router = useRouter()

  const [opts, setOpts] = useState<WidOpt[]>([])
  const [wid, setWid] = useState('')
  const [token, setToken] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr(null)

      // Zbierz unikalne wesela z guests (preferuj organizatorów do ładnej etykiety)
      const { data, error } = await supabase
        .from('guests')
        .select('wedding_id, full_name, role')
        .order('role', { ascending: true }) // guest -> organizer (później nadpiszemy lepszym opisem)
      if (error) { setErr(error.message); setLoading(false); return }

      const seen = new Set<string>()
      const out: Record<string, WidOpt> = {}

      for (const g of data ?? []) {
        if (!seen.has(g.wedding_id)) {
          seen.add(g.wedding_id)
          out[g.wedding_id] = {
            id: g.wedding_id,
            // podstawowa etykieta = sam UUID
            label: g.wedding_id,
          }
        }
        // jeżeli to organizator i mamy full_name – dorzuć do etykiety
        if (g.role === 'organizer' && g.full_name) {
          out[g.wedding_id] = {
            id: g.wedding_id,
            label: `${g.wedding_id} — ${g.full_name}`,
          }
        }
      }

      const list = Object.values(out)
      setOpts(list)
      if (list.length && !wid) setWid(list[0].id)
      setLoading(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!wid || !token) { setErr('Wybierz wesele i wpisz token.'); return }

    const res = await fetch('/api/dj/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weddingId: wid, token }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j?.ok) {
      setErr(j?.error || 'Niepoprawny token')
      return
    }

    // przejście do boxa (zostawiamy to jak wcześniej)
    router.push(`/app/dj?w=${encodeURIComponent(wid)}&s=${encodeURIComponent(j.session)}`)
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">DJ – logowanie</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium">Wesele</label>
          <select
            className="border rounded p-2 w-full"
            value={wid}
            onChange={(e) => setWid(e.target.value)}
            disabled={loading}
          >
            {opts.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        <input
          className="border rounded p-2 w-full"
          placeholder="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />

        <button className="btn w-full" disabled={loading}>Wejdź do DJ boxa</button>

        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </div>
  )
}
