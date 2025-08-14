'use client'
import { useEffect, useMemo, useState } from 'react'
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
  photo_id: string
  user_id: string | null
  content: string
  created_at: string
}

export default function GalleryPage() {
  const supabase = supaClient()

  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [publicUrls, setPublicUrls] = useState<Record<string, string>>({})
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({})

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Lightbox / komentarze
  const [activeId, setActiveId] = useState<string | null>(null)
  const activePhoto = useMemo(() => photos.find(p => p.id === activeId) || null, [photos, activeId])
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      const { data: { user } } = await supabase.auth.getUser()
      setMyId(user?.id ?? null)

      if (user?.id) {
        const { data: me } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(me?.role === 'organizer')
      }

      await refresh(wid)
    })().catch(e => setErr(String(e)))
  }, [])

  async function refresh(wid: string | null) {
    if (!wid) return
    setErr(null)

    const { data, error } = await supabase
      .from('photos')
      .select('id,storage_path,created_at,uploaded_by')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: false })

    if (error) { setErr(error.message); return }

    setPhotos(data ?? [])

    // URL-e
    const urls: Record<string, string> = {}
    for (const p of data ?? []) {
      urls[p.id] = supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl
    }
    setPublicUrls(urls)

    // mapka user_id -> full_name
    const ids = Array.from(new Set((data ?? []).map(p => p.uploaded_by).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: gs } = await supabase
        .from('guests')
        .select('user_id,full_name')
        .in('user_id', ids)
      const m: Record<string, string> = {}
      for (const g of gs ?? []) m[g.user_id] = g.full_name
      setNameByUserId(m)
    } else {
      setNameByUserId({})
    }
  }

  async function uploadSelected() {
    setErr(null)
    if (!selectedFile) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }
    setUploading(true)
    try {
      const path = `${weddingId}/${crypto.randomUUID()}-${selectedFile.name}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, selectedFile, { upsert: true })
      if (upErr) throw upErr
      const { error: insErr } = await supabase
        .from('photos')
        .insert({ wedding_id: weddingId, storage_path: path, uploaded_by: myId })
      if (insErr) throw insErr
      setSelectedFile(null)
      await refresh(weddingId)
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
    }
  }

  async function deletePhoto(p: Photo) {
    if (!confirm('Usunąć zdjęcie?')) return
    setErr(null)
    // Uprawnienia egzekwują polityki – w UI pokażemy przycisk tylko uprawnionym
    const { error: d1 } = await supabase.from('photos').delete().eq('id', p.id)
    if (d1) { setErr(d1.message); return }
    await supabase.storage.from('photos').remove([p.storage_path]).catch(() => {})
    await refresh(weddingId)
    if (activeId === p.id) setActiveId(null)
  }

  // --- komentarze ---

  async function loadComments(photoId: string) {
    setComments([])
    const { data, error } = await supabase
      .from('photo_comments')
      .select('id,photo_id,user_id,content,created_at')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true })
    if (!error) setComments(data ?? [])
  }

  async function addComment() {
    if (!newComment.trim() || !activeId) return
    const { error } = await supabase
      .from('photo_comments')
      .insert({ photo_id: activeId, content: newComment })
    if (error) { alert(error.message); return }
    setNewComment('')
    await loadComments(activeId)
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from('photo_comments').delete().eq('id', id)
    if (error) { alert(error.message); return }
    if (activeId) await loadComments(activeId)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Dodaj zdjęcie</label>
        <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
        <button className="btn disabled:opacity-50" onClick={uploadSelected} disabled={!selectedFile || uploading}>
          {uploading ? 'Wgrywam…' : 'Dodaj'}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map(p => {
          const src = publicUrls[p.id]
          const by = p.uploaded_by ? (nameByUserId[p.uploaded_by] || 'Gość') : 'Gość'
          const canDelete = isOrganizer || (!!myId && myId === p.uploaded_by)
          return (
            <div key={p.id} className="border rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="w-full h-40 object-cover cursor-pointer"
                onClick={() => { setActiveId(p.id); loadComments(p.id) }}
              />
              <div className="p-2 flex items-center justify-between text-sm">
                <span className="text-slate-600 truncate">Autor: {by}</span>
                {canDelete && (
                  <button className="text-red-600 hover:underline" onClick={() => deletePhoto(p)}>
                    Usuń
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* LIGHTBOX + komentarze */}
      {activePhoto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="text-sm">
                <strong>{activePhoto.uploaded_by ? (nameByUserId[activePhoto.uploaded_by] || 'Gość') : 'Gość'}</strong>
                <span className="text-slate-600"> • {new Date(activePhoto.created_at).toLocaleString()}</span>
              </div>
              <button className="nav-link" onClick={() => setActiveId(null)}>Zamknij</button>
            </div>

            <div className="grid md:grid-cols-3 gap-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrls[activePhoto.id]}
                alt=""
                className="md:col-span-2 w-full h-[60vh] object-contain bg-black"
              />

              <div className="p-3 flex flex-col gap-3">
                <h3 className="font-semibold">Komentarze</h3>
                <div className="space-y-2 max-h-[48vh] overflow-auto pr-1">
                  {comments.map(c => (
                    <div key={c.id} className="rounded border p-2">
                      <div className="text-xs text-slate-600 mb-1">
                        <strong>{c.user_id ? (nameByUserId[c.user_id] || 'Gość') : 'Gość'}</strong>
                        <span> • {new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{c.content}</div>
                      {(isOrganizer || (myId && myId === c.user_id)) && (
                        <button className="text-xs text-red-600 mt-1 hover:underline"
                                onClick={() => deleteComment(c.id)}>
                          Usuń
                        </button>
                      )}
                    </div>
                  ))}
                  {comments.length === 0 && <div className="text-sm text-slate-500">Brak komentarzy.</div>}
                </div>

                <div className="flex gap-2 mt-auto">
                  <input
                    className="flex-1 border rounded p-2"
                    placeholder="Dodaj komentarz…"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <button className="btn" onClick={addComment}>Dodaj</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
