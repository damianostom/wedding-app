'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useState } from 'react'

type Photo = { id: string; storage_path: string; created_at: string; uploaded_by: string | null }

export default function GalleryPage() {
  const supabase = supaClient()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [publicUrls, setPublicUrls] = useState<Record<string,string>>({})
  const [names, setNames] = useState<Record<string,string>>({})
  const [uploading, setUploading] = useState(false)
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      // 1) zdjęcia
      const { data, error } = await supabase
        .from('photos')
        .select('id,storage_path,created_at,uploaded_by')
        .order('created_at', { ascending: false })
      if (error) setErr(error.message)
      setPhotos(data ?? [])

      // 2) publiczne URL-e
      const urls: Record<string,string> = {}
      for (const p of data ?? []) {
        urls[p.id] = supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl
      }
      setPublicUrls(urls)

      // 3) mapka user_id -> full_name (dla podpisów)
      const ids = Array.from(new Set((data ?? []).map(p => p.uploaded_by).filter(Boolean))) as string[]
      if (ids.length) {
        const { data: users } = await supabase
          .from('guests')
          .select('user_id, full_name')
          .in('user_id', ids)
        const m: Record<string,string> = {}
        for (const u of users ?? []) m[u.user_id] = u.full_name
        setNames(m)
      }
    })()
  }, []) // mount

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!weddingId) { setErr('Nie znaleziono Twojego wesela.'); return }

    setUploading(true)
    const path = `${weddingId}/${crypto.randomUUID()}-${file.name}`

    // 1) wysyłka do Storage
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (upErr) { setErr(upErr.message); setUploading(false); return }

    // 2) rekord w DB (z uploaded_by)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('photos').insert({
      wedding_id: weddingId,
      storage_path: path,
      uploaded_by: user?.id ?? null
    })

    // 3) UI – dopnij do listy
    const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
    const newId = crypto.randomUUID()
    setPhotos(p => [{ id: newId, storage_path: path, created_at: new Date().toISOString(), uploaded_by: user?.id ?? null }, ...p])
    setPublicUrls(prev => ({ ...prev, [newId]: url, [path]: url }))
    if (user?.id) setNames(prev => ({ ...prev, [user.id]: prev[user.id] || 'Ty' }))
    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Dodaj zdjęcie</label>
        <input type="file" accept="image/*" onChange={onUpload} disabled={uploading || !weddingId}/>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map(p => {
          const src = publicUrls[p.id] || publicUrls[p.storage_path]
          const who = (p.uploaded_by && names[p.uploaded_by]) ? names[p.uploaded_by] : 'Gość'
          return (
            <figure key={p.id} className="border rounded overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-40 object-cover" />
              <figcaption className="px-2 py-1 text-xs text-slate-600">
                Dodane przez: <strong>{who}</strong>
              </figcaption>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
