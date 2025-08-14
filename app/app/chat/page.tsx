'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useRef, useState } from 'react'

type Msg = { id: number; content: string; created_at: string; user_id: string | null }

export default function ChatPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)
      if (!wid) { setErr('Brak powiązania z weselem — dodaj rekord w "guests" dla zalogowanego użytkownika.'); return }
      const { data, error } = await supabase
        .from('messages').select('id,content,created_at,user_id')
        .eq('wedding_id', wid).order('created_at', { ascending: true })
      if (error) setErr(error.message)
      setMsgs(data ?? [])
      const channel = supabase.channel('chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `wedding_id=eq.${wid}` },
          payload => setMsgs(m => [...m, payload.new as any]))
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    })()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    setErr(null)
    if (!text.trim() || !weddingId) return
    const { error } = await supabase.from('messages').insert({ wedding_id: weddingId, content: text })
    if (error) setErr(error.message)
    else setText('')
  }

  return (
    <div className="flex flex-col h-[70vh] border rounded">
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {msgs.map(m => <div key={m.id} className="rounded bg-gray-100 px-2 py-1">{m.content}</div>)}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-2 flex gap-2">
        <input className="flex-1 border rounded p-2" value={text} onChange={e=>setText(e.target.value)} placeholder="Napisz wiadomość..." />
        <button className="btn" onClick={send}>Wyślij</button>
      </div>
      {err && <div className="p-2 text-sm text-red-600">{err}</div>}
    </div>
  )
}
