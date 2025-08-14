'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useState } from 'react'

type Photo = { id: string; storage_path: string; created_at: string }

export default function GalleryPage() {
  const supabase = supaClient()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [publicUrls, setPublicUrls] = useState<Record<string,string>>({})
  const [uploading, setUploading] = useState(false)
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)
      const { data, error } = await supabase.from('photos').select('id,storage_path,created_at').order('created_at', { ascending: false })
      if (error) setErr(error.message)
      setPhotos(data ?? [])
      const urls: Record<string,string> = {}
      for (const p of data ?? []) {
        urls[p.id] = supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl
      }
      setPublicUrls(urls)
    })()
  }, [])

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!weddingId) { setErr('Nie znaleziono Twojego wesela. Upewnij się, że jesteś przypisany w tabeli guests.'); return }
    setUploading(true)
    const path = `${weddingId}/${crypto.randomUUID()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (upErr) { setErr(upErr.message); setUploading(false); return }
    await supabase.from('photos').insert({ wedding_id: weddingId, storage_path: path })
    const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
    setPhotos(p => [{ id: crypto.randomUUID(), storage_path: path, created_at: new Date().toISOString() }, ...p])
    setPublicUrls(prev => ({ ...prev, [path]: url }))
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
          return (
            <a key={p.id} href={src} target="_blank" className="block border rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-40 object-cover" />
            </a>
          )
        })}
      </div>
    </div>
  )
}
