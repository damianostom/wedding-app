'use client'
import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type Photo = {
  id: string
  storage_path: string
  created_at: string
  uploaded_by: string | null
}

export default function GalleryPage() {
  const supabase = supaClient()
  const [wid, setWid] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const myWid = await getMyWeddingId()
      setWid(myWid)

      // rola
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: me } = await supabase.from('guests')
          .select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(me?.role === 'organizer')
      }

      // lista zdjęć
      const { data } = await supabase
        .from('photos')
        .select('id, storage_path, created_at, uploaded_by')
        .eq('wedding_id', myWid)
        .order('created_at', { ascending: false })
      const rows = data ?? []
      setPhotos(rows)

      // mapka user_id → full_name
      const uploaderIds = Array.from(new Set(rows.map(r => r.uploaded_by).filter(Boolean))) as string[]
      if (uploaderIds.length) {
        const { data: gs } = await supabase
          .from('guests').select('user_id, full_name').in('user_id', uploaderIds)
        const map: Record<string, string> = {}
        for (const g of gs ?? []) map[g.user_id] = g.full_name
        setNames(map)
      }

      // publiczne/sygnowane URL-e
      const u: Record<string, string> = {}
      for (const p of rows) {
        // jeśli bucket `photos` jest "public", użyjemy publicUrl:
        const pub = supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl
        if (pub) {
          u[p.id] = pub
        } else {
          // ewentualnie podpisz (gdy bucket prywatny i polityki na to pozwalają)
          const { data: s } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 60 * 10)
          if (s?.signedUrl) u[p.id] = s.signedUrl
        }
      }
      setUrls(u)
    })().catch(e => setErr(String(e)))
  }, []) // mount only

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const file = e.target.files?.[0]
    if (!file || !wid) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const path = `${wid}/${crypto.randomUUID()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: row, error: insErr } = await supabase
        .from('photos')
        .insert({ wedding_id: wid, storage_path: path, uploaded_by: user?.id ?? null })
        .select('id,storage_path,created_at,uploaded_by')
        .single()
      if (insErr) throw insErr

      const pub = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
      const url = pub || (await supabase.storage.from('photos').createSignedUrl(path, 60 * 10)).data?.signedUrl || ''
      setUrls(prev => ({ ...prev, [row.id]: url }))
      setPhotos(prev => [row as Photo, ...prev])
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
      e.currentTarget.value = ''
    }
  }

  async function removePhoto(p: Photo) {
    if (!isOrganizer) return
    setErr(null)
    // usuń z bucketa
    const { error: del1 } = await supabase.storage.from('photos').remove([p.storage_path])
    if (del1) { setErr(del1.message); return }
    // usuń z tabeli
    const { error: del2 } = await supabase.from('photos').delete().eq('id', p.id)
    if (del2) { setErr(del2.message); return }
    setPhotos(prev => prev.filter(x => x.id !== p.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Dodaj zdjęcie</label>
        <input type="file" accept="image/*" onChange={onUpload} disabled={uploading || !wid}/>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map(p => {
          const src = urls[p.id]
          const author = p.uploaded_by ? (names[p.uploaded_by] || 'Gość') : 'Gość'
          return (
            <div key={p.id} className="border rounded overflow-hidden bg-white">
              <a href={src} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-44 object-cover" />
              </a>
              <div className="px-2 py-1 text-xs flex items-center justify-between">
                <span className="text-slate-600">dodał: <strong>{author}</strong></span>
                {isOrganizer && (
                  <button className="text-red-600 hover:underline" onClick={() => removePhoto(p)}>Usuń</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
