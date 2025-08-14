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

  const fileRef = useRef<HTMLInputElement | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [openId, setOpenId] = useState<string | null>(null)

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

      const { data } = await supabase.from('videos')
        .select('id,storage_path,created_at,uploaded_by')
        .order('created_at', { ascending: false })
      setVideos(data ?? [])

      const map: Record<string,string> = {}
      for (const v of data ?? []) {
        map[v.id] = supabase.storage.from('videos').getPublicUrl(v.storage_path).data.publicUrl
      }
      setUrls(map)
    })().catch(e => setErr(String(e)))
  }, [])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setPendingFile(f)
  }

  async function uploadPicked() {
    if (!pendingFile) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }
    setUploading(true)
    try {
      const ext = pendingFile.name.split('.').pop() || 'mp4'
      const path = `${weddingId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('videos').upload(path, pendingFile, {
        upsert: true, contentType: pendingFile.type || 'video/mp4'
      })
      if (upErr) throw upErr

      const { data, error: insErr } = await supabase
        .from('videos')
        .insert({ wedding_id: weddingId, storage_path: path })
        .select('id,storage_path,created_at,uploaded_by')
        .single()
      if (insErr) throw insErr

      const url = supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
      setVideos(prev => [data as Video, ...prev])
      setUrls(prev => ({ ...prev, [(data as Video).id]: url }))
      setPendingFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e:any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
    }
  }

  async function removeVideo(v: Video) {
    if (!isOrganizer && (!meId || meId !== v.uploaded_by)) return
    const res = await fetch('/api/admin/delete-video', {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ videoId: v.id })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Nie udało się usunąć wideo'); return }
    setVideos(prev => prev.filter(x => x.id !== v.id))
    if (openId === v.id) setOpenId(null)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Galeria wideo</h1>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Dodaj film</label>
        <input ref={fileRef} type="file" accept="video/*" onChange={onPick} />
        <button className="btn disabled:opacity-50" onClick={uploadPicked} disabled={!pendingFile || uploading}>
          {uploading ? 'Wgrywam…' : 'Wgraj'}
        </button>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      {/* miniatury = po prostu video z posterem/ pierwszą klatką */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {videos.map(v => {
          const src = urls[v.id]
          return (
            <div key={v.id} className="relative group border rounded overflow-hidden">
              <video src={src} className="w-full h-48 object-cover cursor-pointer" onClick={()=>setOpenId(v.id)} muted />
              {(isOrganizer || (meId && meId === v.uploaded_by)) && (
                <button onClick={()=>removeVideo(v)}
                        className="absolute top-2 right-2 hidden group-hover:block bg-white/80 px-2 py-1 rounded text-sm">
                  Usuń
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* modal player */}
      {openId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b">
              <div className="font-semibold">Odtwarzacz</div>
              <button className="text-sm underline" onClick={()=>setOpenId(null)}>Zamknij</button>
            </div>
            <div className="p-2">
              <video src={urls[openId]} className="w-full max-h-[75vh]" controls autoPlay />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
