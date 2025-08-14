'use client'
import { useEffect, useRef, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type Photo = { id: string; storage_path: string; created_at: string; uploaded_by: string | null }
type Comment = { id: string; content: string; created_at: string; user_id: string | null; sender_name?: string }

export default function GalleryPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [urls, setUrls] = useState<Record<string,string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)

  // modal
  const [openId, setOpenId] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [names, setNames] = useState<Record<string,string>>({})
  const [newComment, setNewComment] = useState('')

  // wielokrotny upload
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

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

      const { data } = await supabase.from('photos')
        .select('id,storage_path,created_at,uploaded_by')
        .order('created_at', { ascending: false })
      setPhotos(data ?? [])

      const links: Record<string,string> = {}
      for (const p of data ?? []) {
        links[p.id] = supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl
      }
      setUrls(links)
    })().catch(e => setErr(String(e)))
  }, [])

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
      const map: Record<string,string> = {}
      for (const g of gs ?? []) map[g.user_id] = g.full_name
      setNames(map)
    }
  }

  async function addComment() {
    if (!openId || !newComment.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    let myId: string | null = user?.id ?? null
    let myName = 'Gość'
    if (myId) {
      const { data: me } = await supabase.from('guests').select('full_name').eq('user_id', myId).maybeSingle()
      if (me?.full_name) myName = me.full_name
    }

    // <<< kluczowa zmiana: zapisujemy user_id w wierszu >>>
    const { data, error } = await supabase
      .from('photo_comments')
      .insert({ photo_id: openId, content: newComment, user_id: myId })
      .select('id,content,created_at,user_id')
      .single()
    if (error) { setErr(error.message); return }

    setComments(prev => [...prev, { ...(data as Comment), sender_name: myName }])
    if (myId) setNames(prev => ({ ...prev, [myId!]: myName }))
    setNewComment('')
  }

  async function deleteComment(id: string, userId: string | null) {
    const can = isOrganizer || (!!meId && meId === userId)
    if (!can) return
    const { error } = await supabase.from('photo_comments').delete().eq('id', id)
    if (!error) setComments(prev => prev.filter(c => c.id !== id))
  }

  function label(u?: string | null, s?: string) {
    return (u && names[u]) || s || 'Gość'
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    setPendingFiles(Array.from(e.target.files ?? []))
  }

  async function uploadPicked() {
    if (!pendingFiles.length) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }
    setUploading(true)
    try {
      for (const f of pendingFiles) {
        const path = `${weddingId}/${crypto.randomUUID()}-${f.name}`
        const { error: upErr } = await supabase.storage.from('photos').upload(path, f, { upsert: true })
        if (upErr) throw upErr
        const { data, error: insErr } = await supabase
          .from('photos').insert({ wedding_id: weddingId, storage_path: path })
          .select('id,storage_path,created_at,uploaded_by').single()
        if (insErr) throw insErr
        setPhotos(prev => [data as Photo, ...prev])
        const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
        setUrls(prev => ({ ...prev, [(data as Photo).id]: url }))
      }
      setPendingFiles([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto(p: Photo) {
    if (!isOrganizer && (!meId || meId !== p.uploaded_by)) return
    const res = await fetch('/api/admin/delete-photo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: p.id })
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || 'Nie udało się usunąć zdjęcia'); return }
    setPhotos(prev => prev.filter(x => x.id !== p.id))
    if (openId === p.id) setOpenId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Dodaj zdjęcia</label>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPick} />
        <button className="btn disabled:opacity-50" onClick={uploadPicked} disabled={!pendingFiles.length || uploading}>
          {uploading ? 'Wgrywam…' : `Wgraj (${pendingFiles.length})`}
        </button>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map(p => {
          const src = urls[p.id]
          return (
            <div key={p.id} className="relative group border rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-40 object-cover cursor-pointer" onClick={()=>openModal(p.id)} />
              {(isOrganizer || (meId && meId === p.uploaded_by)) && (
                <button onClick={()=>removePhoto(p)}
                        className="absolute top-2 right-2 hidden group-hover:block bg-white/80 px-2 py-1 rounded text-sm">Usuń</button>
              )}
            </div>
          )
        })}
      </div>

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
                <button className="text-sm underline" onClick={()=>setOpenId(null)}>Zamknij</button>
              </div>
              <div className="mt-2 flex-1 overflow-auto space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="rounded border p-2">
                    <div className="text-xs text-slate-600 mb-1">
                      <strong>{label(c.user_id, c.sender_name)}</strong> • {new Date(c.created_at).toLocaleString()}
                    </div>
                    <div>{c.content}</div>
                    {(isOrganizer || (meId && meId === c.user_id)) && (
                      <button className="text-xs text-red-600 mt-1 underline" onClick={()=>deleteComment(c.id, c.user_id!)}>Usuń</button>
                    )}
                  </div>
                ))}
                {!comments.length && <div className="text-sm text-slate-500">Brak komentarzy.</div>}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 border rounded p-2" placeholder="Dodaj komentarz..." value={newComment} onChange={e=>setNewComment(e.target.value)} />
                <button className="btn" onClick={addComment}>Dodaj</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
