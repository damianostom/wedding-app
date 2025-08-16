'use client'

import { useEffect, useRef, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type Video = { id: string; storage_path: string; created_at: string; uploaded_by: string | null }

function baseName(path: string) {
  return path.split('/').pop() || 'video.mp4'
}

export default function VideosPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [urls, setUrls] = useState<Record<string,string>>({})
  const [posters, setPosters] = useState<Record<string,string>>({}) // <- poster dla mobile
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // multi–upload
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [pending, setPending] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // multi–download
  const [selected, setSelected] = useState<Set<string>>(new Set())

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

  // wygeneruj poster z 1. klatki – działa też na iOS
  async function makePoster(el: HTMLVideoElement, id: string) {
    if (posters[id]) return
    try {
      // metadata musi być wczytana
      if (el.readyState < 1) await new Promise<void>(r => el.addEventListener('loadedmetadata', () => r(), { once:true }))
      // przesuń się minimalnie do przodu i odczekaj seek
      const t = Math.min(0.1, (el.duration || 0.1))
      await new Promise<void>(r => {
        const onSeek = () => { el.removeEventListener('seeked', onSeek); r() }
        el.addEventListener('seeked', onSeek)
        el.currentTime = t
      })
      const canvas = document.createElement('canvas')
      canvas.width = el.videoWidth; canvas.height = el.videoHeight
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      setPosters(prev => ({ ...prev, [id]: dataUrl }))
    } catch {
      // ciche – zostawimy bez postera
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    setPending(list)
  }

  async function uploadPicked() {
    if (!pending.length) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }
    setUploading(true)
    try {
      for (const f of pending) {
        const ext = (f.name.split('.').pop() || 'mp4').toLowerCase()
        const path = `${weddingId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('videos').upload(path, f, {
          upsert: true, contentType: f.type || 'video/mp4'
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
      }
      setPending([])
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
    setSelected(prev => { const s = new Set(prev); s.delete(v.id); return s })
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function downloadSelected() {
    if (!selected.size) return
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const id of Array.from(selected)) {
      const url = urls[id]; if (!url) continue
      const name = baseName(videos.find(v => v.id === id)?.storage_path || `${id}.mp4`)
      const res = await fetch(url); const blob = await res.blob()
      zip.file(name, blob)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'filmy.zip'
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Galeria wideo</h1>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Dodaj filmy</label>
        <input ref={fileRef} type="file" accept="video/*" multiple onChange={onPick} />
        <button className="btn disabled:opacity-50" onClick={uploadPicked} disabled={!pending.length || uploading}>
          {uploading ? 'Wgrywam…' : `Wgraj (${pending.length})`}
        </button>

        {selected.size > 0 && (
          <button className="btn" onClick={downloadSelected}>Pobierz zaznaczone ({selected.size})</button>
        )}
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {videos.map(v => {
          const src = urls[v.id]; const poster = posters[v.id]
          return (
            <div key={v.id} className="relative group border rounded overflow-hidden">
              <video
                src={src}
                className="w-full h-48 object-cover cursor-pointer bg-black/5"
                muted
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
                poster={poster}
                onLoadedData={(e)=>makePoster(e.currentTarget, v.id)}
              />
              {/* checkbox wybierania */}
              <label className="absolute top-2 left-2 bg-white/80 rounded px-2 py-1 text-xs cursor-pointer">
                <input type="checkbox" checked={selected.has(v.id)} onChange={()=>toggleSelect(v.id)} /> Zaznacz
              </label>
              {/* pobierz jeden */}
              <a
                href={src}
                download={baseName(v.storage_path)}
                className="absolute bottom-2 left-2 hidden group-hover:block bg-white/90 px-2 py-1 rounded text-xs"
              >
                Pobierz
              </a>
              {(isOrganizer || (meId && meId === v.uploaded_by)) && (
                <button
                  onClick={()=>removeVideo(v)}
                  className="absolute top-2 right-2 hidden group-hover:block bg-white/90 px-2 py-1 rounded text-xs">
                  Usuń
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
