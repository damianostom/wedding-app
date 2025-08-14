'use client'
import { supaClient } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function InfoPage() {
  const supabase = supaClient()
  const [title, setTitle] = useState('Najważniejsze informacje')
  const [content, setContent] = useState('')
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: page } = await supabase.from('info_pages').select('*').maybeSingle()
      if (page) { setTitle(page.title ?? title); setContent(page.content ?? '') }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(data?.role === 'organizer')
      }
      setLoading(false)
    })()
  }, [])

  async function save() {
    const { error } = await supabase.from('info_pages').update({ title, content })
    if (error) alert(error.message)
    else alert('Zapisano')
  }

  if (loading) return <p>Ładowanie…</p>

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {isOrganizer ? (
        <>
          <input className="border p-2 rounded w-full" value={title} onChange={e=>setTitle(e.target.value)} />
          <textarea className="border p-2 rounded w-full h-40" value={content} onChange={e=>setContent(e.target.value)} />
          <button className="bg-black text-white px-4 py-2 rounded" onClick={save}>Zapisz</button>
        </>
      ) : (
        <div className="prose whitespace-pre-wrap">{content || 'Brak treści'}</div>
      )}
    </div>
  )
}
