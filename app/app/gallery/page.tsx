'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type PhotoRow = {
  id: string
  storage_path: string
  created_at: string
  uploaded_by?: string | null
}

type PhotoVM = {
  id: string
  url: string
  created_at: string
  who?: string
}

export default function GalleryPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoVM[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Lightbox
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const current = photos[idx]

  // wczytaj zdjęcia
  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      // pobierz rekordy z DB (tylko z mojego wesela)
      const { data: rows, error } = await supabase
        .from('photos')
        .select('id,storage_path,created_at,uploaded_by')
        .order('created_at', { ascending: false })

      if (error) { setErr(error.message); return }

      // mapka user_id -> full_name (opcjonalnie)
      let nameByUser: Record<string, string> = {}
      const uploaderIds = Array.from(new Set((rows ?? []).map(r => r.uploaded_by).filter(Boolean))) as string[]
      if (uploaderIds.length) {
        const { data: gs } = await supabase.from('guests')
          .select('user_id,full_name').in('user_id', uploaderIds)
        for (const g of gs ?? []) nameByUser[g.user_id] = g.full_name
      }

      // publiczne URL-e
      const list: PhotoVM[] = []
      for (const r of (rows ?? [])) {
        const pub = supabase.storage.from('photos').getPublicUrl(r.storage_path).data.publicUrl
        list.push({
          id: r.id,
          url: pub,
          created_at: r.created_at,
          who: r.uploaded_by ? (nameByUser[r.uploaded_by] || 'Gość') : undefined
        })
      }
      setPhotos(list)
    })()
  }, [])

  // upload
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!weddingId) { setErr('Nie znaleziono Twojego wesela. Upewnij się, że jesteś przypisany w tabeli guests.'); return }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const path = `${weddingId}/${crypto.randomUUID()}-${file.name}`
      const up = await supabase.storage.from('photos').upload(path, file, { upsert: true })
      if (up.error) throw up.error

      // spróbuj wstawić uploaded_by – jeśli kolumny brak, spróbuj bez
      const insert = await supabase
        .from('photos')
        .insert({ wedding_id: weddingId, storage_path: path, uploaded_by: user?.id ?? null })
        .select('id,storage_path,created_at,uploaded_by')
        .single()

      let row: PhotoRow
      if (insert.error) {
        // fallback bez uploaded_by
        const ins2 = await supabase
          .from('photos')
          .insert({ wedding_id: weddingId, storage_path: path })
          .select('id,storage_path,created_at')
          .single()
        if (ins2.error) throw ins2.error
        row = ins2.data as PhotoRow
      } else {
        row = insert.data as PhotoRow
      }

      const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
      setPhotos(prev => [{ id: row.id, url, created_at: row.created_at, who: undefined }, ...prev])
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
      e.currentTarget.value = ''
    }
  }

  // lightbox – obsługa klawiatury
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (!open) return
      if (ev.key === 'Escape') setOpen(false)
      if (ev.key === 'ArrowRight') setIdx(i => (i + 1) % photos.length)
      if (ev.key === 'ArrowLeft') setIdx(i => (i - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, photos.length])

  const canNav = photos.length > 1

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Dodaj zdjęcie</label>
        <input type="file" accept="image/*" onChange={onUpload} disabled={uploading || !weddingId}/>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      {/* siatka miniatur */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            className="block border rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-500"
            onClick={() => { setIdx(i); setOpen(true) }}
            title={p.who ? `Autor: ${p.who}` : 'Podgląd'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-40 object-cover" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {open && current && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt="" className="max-h-[80vh] w-full object-contain rounded" />
            <div className="mt-2 flex items-center justify-between text-white/90 text-sm">
              <div>{current.who ? `Autor: ${current.who}` : 'Autor: —'}</div>
              <div className="flex items-center gap-3">
                <a href={current.url} download className="underline">Pobierz</a>
                <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={() => setOpen(false)}>Zamknij</button>
              </div>
            </div>

            {canNav && (
              <>
                <button
                  className="absolute left-0 top-1/2 -translate-y-1/2 px-3 py-2 text-white text-2xl"
                  onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
                  aria-label="Poprzednie"
                >‹</button>
                <button
                  className="absolute right-0 top-1/2 -translate-y-1/2 px-3 py-2 text-white text-2xl"
                  onClick={() => setIdx(i => (i + 1) % photos.length)}
                  aria-label="Następne"
                >›</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
