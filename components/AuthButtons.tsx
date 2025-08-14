'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supaClient } from '@/lib/supabaseClient'

export default function AuthButtons() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    (async () => {
      const supabase = supaClient()
      const { data: { session } } = await supabase.auth.getSession()
      setAuthed(!!session)
    })()
  }, [])

  async function logout() {
    // zakończ sesję po stronie API (czyści cookies)
    await fetch('/api/auth/logout', { method: 'POST' })
    // i „na wszelki wypadek” zakończ również po stronie klienta
    const supabase = supaClient()
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  if (authed === null) return null

  return authed ? (
    <div className="flex gap-2">
      <Link className="btn" href="/app">Panel</Link>
      <button className="btn" onClick={logout}>Wyloguj</button>
    </div>
  ) : (
    <Link className="btn" href="/login">Zaloguj</Link>
  )
}
