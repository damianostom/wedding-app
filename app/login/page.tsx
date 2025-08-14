'use client'
import { supaClient } from '@/lib/supabaseClient'
import { useState } from 'react'

function slugify(s: string) {
  return s
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function LoginPage() {
  const supabase = supaClient()
  const [firstName, setFirst] = useState('')
  const [lastName, setLast] = useState('')
  const [password, setPass] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)

    const username = `${slugify(firstName)}-${slugify(lastName)}`
    const email = `${username}@noemail.local`

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) setErr(error.message)
    else window.location.href = '/app'
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Logowanie imię + nazwisko + hasło</h1>
      <form onSubmit={handleLogin} className="space-y-3">
        <input className="w-full border rounded p-2" placeholder="Imię" value={firstName} onChange={e=>setFirst(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Nazwisko" value={lastName} onChange={e=>setLast(e.target.value)} />
        <input className="w-full border rounded p-2" type="password" placeholder="Hasło" value={password} onChange={e=>setPass(e.target.value)} />
        <button className="btn w-full disabled:opacity-50" disabled={loading || !firstName || !lastName || !password}>
          {loading ? 'Loguję…' : 'Zaloguj'}
        </button>
      </form>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <p className="text-sm text-slate-600">Nie masz konta? Poproś organizatora o dodanie w panelu „Admin → Konta gości”.</p>
    </div>
  )
}
