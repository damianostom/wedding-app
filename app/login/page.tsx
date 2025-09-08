'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [mode, setMode] = useState<'guest' | 'organizer'>('guest')

  // Gość (bez hasła)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')

  // Organizator (e-mail + hasło)
  const [email, setEmail] = useState('')
  const [passO, setPassO] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      if (mode === 'guest') {
        const res = await fetch('/api/auth/guest-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: first, lastName: last }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Błąd logowania gościa')
      } else {
        const res = await fetch('/api/auth/password-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: passO }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Błąd logowania organizatora')
      }
      window.location.assign('/app')
    } catch (e: any) {
      setErr(e.message ?? 'Błąd logowania')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Logowanie</h1>

      <div className="flex gap-2">
        <button className={`nav-link ${mode==='guest'?'nav-link-active':''}`} onClick={()=>setMode('guest')}>
          Gość (bez hasła)
        </button>
        <button className={`nav-link ${mode==='organizer'?'nav-link-active':''}`} onClick={()=>setMode('organizer')}>
          Organizator
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === 'guest' ? (
          <>
            <input className="w-full border rounded p-2" placeholder="Imię" value={first} onChange={e=>setFirst(e.target.value)} />
            <input className="w-full border rounded p-2" placeholder="Nazwisko" value={last} onChange={e=>setLast(e.target.value)} />
            <button className="btn w-full disabled:opacity-50" disabled={loading || !first || !last}>
              {loading ? 'Loguję…' : 'Wejdź jako Gość'}
            </button>
            <p className="text-xs text-slate-600">Konto gościa zostanie utworzone automatycznie.</p>
          </>
        ) : (
          <>
            <input className="w-full border rounded p-2" type="email" placeholder="E-mail organizatora" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="w-full border rounded p-2" type="password" placeholder="Hasło" value={passO} onChange={e=>setPassO(e.target.value)} />
            <button className="btn w-full disabled:opacity-50" disabled={loading || !email || !passO}>
              {loading ? 'Loguję…' : 'Zaloguj (Organizator)'}
            </button>
          </>
        )}
      </form>

      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
