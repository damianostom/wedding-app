'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'

export default function AuthButtons() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = supaClient()
    supabase.auth.getSession().then(({ data: { session } }) => setAuthed(!!session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session)
    })
    return () => { sub?.subscription.unsubscribe() }
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
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
