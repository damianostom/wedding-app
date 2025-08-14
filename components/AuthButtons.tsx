'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AuthButtons() {
  const [isAuthed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    // sprawdź sesję po stronie klienta (z localStorage)
    import('@supabase/supabase-js').then(async ({ createClient }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const s = await supabase.auth.getSession()
      setAuthed(!!s.data.session)
    })
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/')
  }

  if (isAuthed === null) return null
  return isAuthed ? (
    <div className="flex gap-2">
      <Link className="btn" href="/app">Panel</Link>
      <button className="btn" onClick={logout}>Wyloguj</button>
    </div>
  ) : (
    <Link className="btn" href="/login">Zaloguj</Link>
  )
}
