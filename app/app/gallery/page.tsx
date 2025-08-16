'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type Photo = {
  id: string
  storage_path: string
  created_at: string
  uploaded_by: string | null
}
type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string | null
}

export default function GalleryPage() {
  const supabase = supaClient()

  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)

  // upload (multi)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [pending, setPending] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // modal + komentarze
  const [openId, setOpenId] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [newComment, setNewComment] = useState('')

  // wybór do ZIP
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    ;(async () => {
      setErr(null)

      const wid = await getMyWeddingId()
      setWeddingId(wid)

      const { data: { user } } = await supabase.auth.getUser()
      setMeId(user?.id ?? null)

      if (user) {
        const { data: r } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(r?.role === 'organizer')
      }

      // zdjęcia (RLS ograniczy do wesela)
      const { data: ps, error } = await supabase
        .from('photos')
        .select('id,storage_path,created_at,uploaded_by')
        .order('created_at', { ascending: false })

      if (error) { setErr(error.message); return }
      setPhotos(ps ?? [])

      const map: Record<string, string> = {}
      for (const p of ps ?? []) {
        map[p.id] = supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl
      }
      setUrls(map)
    })().catch((e) => setErr(String(e)))
  }, [])

  // ————————————— UPLOAD —————————————
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPending(files)
  }

  async function uploadAll() {
    if (!pending.length) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }

    setUploading(true); setErr(null)
    try {
      for (const f of pending) {
        const safeName = f.name.replace(/\s+/g, '-')
        const path = `${weddingId}/${crypto.randomUUID()}-${safeName}`
        const { error: upErr } = await supabase.storage.from('photos').upload(path, f, { upsert: true })
        if (upErr) throw upErr

        const { data: row, error: insErr } = await supabase
          .from('photos')
          .insert({ wedding_id: weddingId, storage_path: path })
          .select('id,storage_path,created_at,uploaded_by')
          .single()
        if (insErr) throw insErr

        const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
        setPhotos(prev => [row as Photo, ...prev])
        setUrls(prev => ({ ...prev, [(row as Photo).id]: url }))
      }
      // czyścimy wybór
      setPending([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
    }
  }

  // ————————————— MODAL + KOMENTARZE —————————————
  async function openModal(photoId: string) {
    setOpenId(photoId); setErr(null)
    const { data: cs, error } = await supabase
      .from('photo_comments')
      .select('id,content,created_at,user_id')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true })

    if (error) { setErr(error.message); return }
    setComments(cs ?? [])

    const ids = Array.from(new Set((cs ?? []).map(c => c.user_id).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: gs } = await supabase.from('guests').select('user_id,full_name').in('user_id', ids)
      const map: Record<string, string> = {}
      for (const g of gs ?? []) map[g.user_id] = g.full_name
      setNames(map)
    } else {
      setNames({})
    }
  }

  async function addComment() {
    if (!openId || !newComment.trim()) return

    // ustal mój podpis (jak w czacie)
    const { data: { user } } = await supabase.auth.getUser()
    let myId: string | null = null
    let myName = 'Gość'
    if (user?.id) {
      myId = user.id
      const { data: me } = await supabase.from('guests').select('full_name').eq('user_id', user.id).maybeSingle()
      if (me?.full_name) myName = me.full_name
    }

    const { data, error } = await supabase
      .from('photo_comments')
      .insert({ photo_id: openId, content: newComment }) // user_id = DEFAULT auth.uid() z RLS
      .select('id,content,created_at,user_id')
      .single()
    if (error) { setErr(error.message); return }

    setComments(prev => [...prev, data as Comment])
    if (myId) setNames(prev => ({ ...prev, [myId!]: myName }))
    setNewComment('')
  }

  async function deleteComment(id: string, userId: string | null) {
    const can = isOrganizer || (!!meId && meId === userId)
    if (!can) return
    const { error } = await supabase.from('photo_comments').delete().eq('id', id)
    if (!error) setComments(prev => prev.filter(c => c.id !== id))
  }

  function who(u?: string | null) {
    if (u && names[u]) return names[u]
    return 'Gość'
  }

  // ————————————— USUWANIE ZDJĘĆ —————————————
  async function removePhoto(p: Photo) {
    if (!isOrganizer && (!meId || meId !== p.uploaded_by)) return
    const res = await fetch('/api/admin/delete-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: p.id })
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || 'Nie udało się usunąć zdjęcia'); return }
    setPhotos(prev => prev.filter(x => x.id !== p.id))
    setSelectedIds(prev => {
      const n = new Set(prev); n.delete(p.id); return n
    })
    if (openId === p.id) setOpenId(null)
  }

  // ————————————— POBIERANIE —————————————
  function downloadSingle(p: Photo) {
    const url = urls[p.id]; if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = p.storage_path.split('/').pop() || 'photo.jpg'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function downloadSelectedZip() {
    if (!selectedIds.size) return
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()

    const queue = Array.from(selectedIds)
    for (const id of queue) {
      const p = photos.find(x => x.id === id)
      const url = urls[id]
      if (!p || !url) continue
      const resp = await fetch(url)
      const blob = await resp.blob()
      const name = p.storage_path.split('/').pop() || `${id}.jpg`
      zip.file(name, blob)
    }

    const content = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(content)
    link.download = 'zdjecia.zip'
    document.body.appendChild(link)
    link.click()
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove() }, 0)
  }

  // ————————————— ZAZNACZANIE —————————————
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }
  const allSelected = useMemo(
    () => photos.length > 0 && selectedIds.size === photos.length,
    [photos.length, selectedIds.size]
  )
  function selectAll(v: boolean) {
    setSelectedIds(v ? new Set(photos.map(p => p.id)) : new Set())
  }

  return (
    <div className="space-y-4">
      {/* upload */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Dodaj zdjęcia</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
        />
        <button
          className="btn disabled:opacity-50"
          onClick={uploadAll}
          disabled={!pending.length || uploading}
        >
          {uploading ? 'Wgrywam…' : `Wgraj (${pending.length})`}
        </button>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      {/* akcje grupowe */}
      {photos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={e => selectAll(e.target.checked)}
            />
            Zaznacz wszystko
          </label>
          <button
            className="btn disabled:opacity-50"
            onClick={downloadSelectedZip}
            disabled={!selectedIds.size}
          >
            Pobierz wybrane (.zip)
          </button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-slate-600">
              Zaznaczone: {selectedIds.size}
            </span>
          )}
        </div>
      )}

      {/* siatka */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((p) => {
          const src = urls[p.id]
          const checked = selectedIds.has(p.id)
          return (
            <div key={p.id} className="relative group border rounded overflow-hidden bg-white">
              {/* zaznaczanie */}
              <div className="absolute top-2 left-2 z-10 bg-white/80 rounded px-2 py-1">
                <label className="inline-flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(p.id)}
                  />
                  zaznacz
                </label>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="w-full h-40 object-cover cursor-pointer"
                onClick={() => openModal(p.id)}
              />

              {/* akcje pojedyncze */}
              <div className="absolute right-2 top-2 hidden gap-2 group-hover:flex">
                <button
                  className="bg-white/90 px-2 py-1 rounded text-sm"
                  onClick={() => downloadSingle(p)}
                >
                  Pobierz
                </button>
                {(isOrganizer || (meId && meId === p.uploaded_by)) && (
                  <button
                    onClick={() => removePhoto(p)}
                    className="bg-white/90 px-2 py-1 rounded text-sm"
                  >
                    Usuń
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* modal: podgląd + komentarze */}
      {openId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-5 gap-0">
            <div className="md:col-span-3 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[openId]} alt="" className="w-full max-h-[75vh] object-contain" />
            </div>
            <div className="md:col-span-2 border-l p-3 flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Komentarze</h3>
                <button className="text-sm underline" onClick={() => setOpenId(null)}>Zamknij</button>
              </div>

              <div className="mt-2 flex-1 overflow-auto space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="rounded border p-2">
                    <div className="text-xs text-slate-600 mb-1">
                      <strong>{who(c.user_id)}</strong> • {new Date(c.created_at).toLocaleString()}
                    </div>
                    <div>{c.content}</div>
                    {(isOrganizer || (meId && meId === c.user_id)) && (
                      <button
                        className="text-xs text-red-600 mt-1 underline"
                        onClick={() => deleteComment(c.id, c.user_id)}
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                ))}
                {!comments.length && <div className="text-sm text-slate-500">Brak komentarzy.</div>}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 border rounded p-2"
                  placeholder="Dodaj komentarz..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                />
                <button className="btn" onClick={addComment}>Dodaj</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
