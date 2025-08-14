'use client'
import { useEffect, useRef, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type Video = { id: string; storage_path: string; created_at: string; uploaded_by: string | null }

export default function VideosPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [urls, setUrls] = useState<Record<string,string>>({})
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      const { data: { user } } = await supabase.auth.getUser()
      setMeId(user?.id ?? null)
      if (user) {
        const { data: r } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(r?.role === 'organizer')
      }

      const { data } = await supabase
        .from('videos')
        .select('id,storage_path,created_at,uploaded_by')
        .order('created_at', { ascending: false })
      setVideos(data ?? [])
      const m: Record<string,string> = {}
      for (const v of data ?? []) m[v.id] = supabase.storage.from('videos').getPublicUrl(v.storage_path).data.publicUrl
      setUrls(m)
    })().catch(e => setErr(String(e)))
  }, [])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setPending(e.target.files?.[0] ?? null)
  }

  async function upload() {
    if (!pending || !weddingId) return
    setBusy(true); setErr(null)
    try {
      const path = `${weddingId}/${crypto.randomUUID()}-${pending.name}`
      const { error: upErr } = await supabase.storage.from('videos').upload(path, pending, { upsert: true })
      if (upErr) throw upErr
      const { data, error: insErr } = await supabase
        .from('videos')
        .insert({ wedding_id: weddingId, storage_path: path })
        .select('id,storage_path,created_at,uploaded_by').single()
      if (insErr) throw insErr
      setVideos(prev => [data as Video, ...prev])
      setUrls(prev => ({ ...prev, [(data as Video).id]: supabase.storage.from('videos').getPublicUrl(path).data.publicUrl }))
      setPending(null); if (inputRef.current) inputRef.current.value = ''
    } catch (e: any) { setErr(e?.message || 'Błąd wgrywania') }
    finally { setBusy(false) }
  }

  async function remove(v: Video) {
    if (!isOrganizer && (!meId || meId !== v.uploaded_by)) return
    const res = await fetch('/api/admin/delete-video', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ videoId: v.id })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Nie udało się usunąć wideo'); return }
    setVideos(prev => prev.filter(x => x.id !== v.id))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Galeria wideo</h1>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Dodaj film</label>
        <input ref={inputRef} type="file" accept="video/*" onChange={onPick} />
        <button className="btn disabled:opacity-50" onClick={upload} disabled={!pending || busy}>
          {busy ? 'Wgrywam…' : 'Wgraj'}
        </button>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map(v => (
          <div key={v.id} className="border rounded p-2 relative group">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={urls[v.id]} controls className="w-full max-h-[360px]" />
            {(isOrganizer || (meId && meId === v.uploaded_by)) && (
              <button onClick={()=>remove(v)} className="absolute top-2 right-2 hidden group-hover:block bg-white/80 px-2 py-1 rounded text-sm">
                Usuń
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
