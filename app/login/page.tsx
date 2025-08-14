'use client'
import { supaClient } from '@/lib/supabaseClient'
import { useState } from 'react'

export default function LoginPage() {
  const supabase = supaClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/app` }
    })
    setLoading(false)
    if (error) alert(error.message)
    else setSent(true)
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Logowanie</h1>
      {sent ? (
        <p>Sprawdź skrzynkę – wysłaliśmy link logowania.</p>
      ) : (
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            type="email" placeholder="Twój e-mail"
            value={email} onChange={e=>setEmail(e.target.value)}
          />
          <button className="bg-black text-white rounded px-4 py-2 disabled:opacity-50" disabled={loading || !email}>
            {loading ? 'Wysyłam…' : 'Wyślij link'}
          </button>
        </form>
      )}
    </div>
  )
}
