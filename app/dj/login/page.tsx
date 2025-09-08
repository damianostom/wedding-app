'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DjLoginPage() {
  const [token, setToken] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      const res = await fetch('/api/dj/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Błąd logowania')

      // ✅ pewna nawigacja po udanym logowaniu
      router.push('/dj')
    } catch (e: any) {
      setErr(e?.message || 'Błąd logowania')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">DJ – logowanie</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Token"
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        <button className="btn w-full disabled:opacity-50" disabled={loading || !token.trim()}>
          {loading ? 'Loguję…' : 'Wejdź do DJ boxa'}
        </button>
      </form>
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
