'use client'
import { useState } from 'react'

function slugify(s: string) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // bezpieczne parsowanie – jeśli nie JSON, czytamy tekst
  const ct = res.headers.get('content-type') || ''
  let data: any = null
  try {
    data = ct.includes('application/json') ? await res.json() : await res.text()
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data) ? (data as any).error : (typeof data === 'string' && data) || res.statusText
    throw new Error(msg || 'Błąd zapytania')
  }
  return data
}

export default function LoginPage() {
  const [mode, setMode] = useState<'guest' | 'organizer'>('guest')

  // gość
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [passG, setPassG] = useState('')

  // organizator
  const [email, setEmail] = useState('')
  const [passO, setPassO] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      let emailToSend = email, passwordToSend = passO
      if (mode === 'guest') {
        const username = `${slugify(first)}-${slugify(last)}`
        emailToSend = `${username}@noemail.local`
        passwordToSend = passG
      }
      await postJson('/api/auth/password-login', { email: emailToSend, password: passwordToSend })
      // cookies ustawione po stronie serwera → middleware widzi sesję
      window.location.assign('/app')
    } catch (e: any) {
      setErr(e.message ?? 'Błąd logowania')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Logowanie</h1>

      <div className="flex gap-2">
        <button className={`nav-link ${mode==='guest'?'nav-link-active':''}`} onClick={()=>setMode('guest')}>Gość</button>
        <button className={`nav-link ${mode==='organizer'?'nav-link-active':''}`} onClick={()=>setMode('organizer')}>Organizator</button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === 'guest' ? (
          <>
            <input className="w-full border rounded p-2" placeholder="Imię" value={first} onChange={e=>setFirst(e.target.value)} />
            <input className="w-full border rounded p-2" placeholder="Nazwisko" value={last} onChange={e=>setLast(e.target.value)} />
            <input className="w-full border rounded p-2" type="password" placeholder="Hasło" value={passG} onChange={e=>setPassG(e.target.value)} />
            <button className="btn w-full disabled:opacity-50" disabled={loading || !first || !last || !passG}>
              {loading ? 'Loguję…' : 'Zaloguj (Gość)'}
            </button>
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
