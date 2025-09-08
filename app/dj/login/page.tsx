'use client'

import { useEffect, useState } from 'react'

type W = { id: string; name: string }

export const dynamic = 'force-dynamic'

export default function DjLogin() {
  const [token, setToken] = useState('')
  const [weddingId, setWeddingId] = useState('')
  const [list, setList] = useState<W[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/dj/weddings').then(r=>r.json()).then((j:W[])=>{
      setList(j); if (j[0]) setWeddingId(j[0].id)
    }).catch(e=>setErr(String(e)))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setLoading(true)
    try {
      const res = await fetch('/api/dj/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ token, weddingId })
      })
      const j = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(j.error || 'Niepoprawny token')
      window.location.assign('/dj')
    } catch (e:any) {
      setErr(e?.message || 'Błąd logowania')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">DJ – logowanie</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium">Wesele</label>
          <select className="w-full border rounded p-2"
                  value={weddingId} onChange={e=>setWeddingId(e.target.value)}>
            {list.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <input className="w-full border rounded p-2" placeholder="Token DJ-a"
               value={token} onChange={e=>setToken(e.target.value)} />
        <button className="btn w-full disabled:opacity-50" disabled={!token || !weddingId || loading}>
          {loading ? 'Loguję…' : 'Wejdź do DJ boxa'}
        </button>
      </form>
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
