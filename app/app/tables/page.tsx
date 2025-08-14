'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { SeatingPDF } from '@/components/SeatingPDF'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false }
)

type Table = { id: string; name: string }
type Assigned = { table_id: string; guest_id: string }
type Guest = { id: string; full_name: string }

type PlanLink = { path: string; url: string }

// proste „slugify” do nazw plików
function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function TablesPage() {
  const supabase = supaClient()
  const [tables, setTables] = useState<Table[]>([])
  const [assign, setAssign] = useState<Assigned[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [weddingId, setWeddingId] = useState<string | null>(null)

  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<PlanLink[]>([])
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // ← NOWE: multi-select + własna nazwa
  const [picked, setPicked] = useState<File[]>([])
  const [customName, setCustomName] = useState('')     // używana tylko gdy wybrano 1 plik
  const [overwrite, setOverwrite] = useState(false)    // pozwól nadpisać jeśli istnieje

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      const { data: t } = await supabase.from('tables').select('id,name').order('name')
      const { data: a } = await supabase.from('table_assignments').select('table_id,guest_id')
      const { data: g } = await supabase.from('guests').select('id,full_name').order('full_name')
      setTables(t ?? []); setAssign(a ?? []); setGuests(g ?? [])

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: r } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(r?.role === 'organizer')
      }

      if (wid) await refreshList(wid)
    })().catch((e)=>setErr(String(e)))
  }, [])

  const model = useMemo(() => {
    return tables.map((t) => ({
      name: t.name,
      guests: assign
        .filter((a) => a.table_id === t.id)
        .map((a) => guests.find((g) => g.id === a.guest_id)?.full_name || '???'),
    }))
  }, [tables, assign, guests])

  async function refreshList(wid: string) {
    const { data: list, error } = await supabase.storage.from('pdf').list(wid, { limit: 200 })
    if (error) { setErr(error.message); return }
    const out: PlanLink[] = []
    for (const obj of list ?? []) {
      const path = `${wid}/${obj.name}`
      const { data: s } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
      if (s?.signedUrl) out.push({ path, url: s.signedUrl })
    }
    // najnowsze (alfabetycznie też często będzie sensownie)
    out.sort((a, b) => a.path.localeCompare(b.path)).reverse()
    setFiles(out)
  }

  async function generateAndUpload() {
    setErr(null)
    if (!isOrganizer || !weddingId) return
    const { pdf } = await import('@react-pdf/renderer')
    const doc = <SeatingPDF tables={model} />
    const blob = await pdf(doc).toBlob()
    const path = `${weddingId}/plan-stolow.pdf`

    const { error: upErr } = await supabase.storage.from('pdf').upload(path, blob, {
      upsert: true,
      contentType: 'application/pdf',
    })
    if (upErr) { setErr(upErr.message); return }

    const { data } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
    setSignedUrl(data?.signedUrl || null)
    await refreshList(weddingId!)
  }

  /** wybór plików */
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const list = Array.from(e.target.files || [])
    setPicked(list)
    // jeżeli wybrano 1 plik – zaproponuj nazwę bez rozszerzenia
    if (list.length === 1) {
      const base = list[0].name.replace(/\.[^.]+$/, '')
      setCustomName(slugify(base))
    } else {
      setCustomName('')
    }
  }

  /** upload – obsługuje wiele plików; dla jednego możesz nadać własną nazwę */
  async function uploadPicked() {
    if (!picked.length) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }

    setUploading(true)
    try {
      for (const f of picked) {
        const ext = (f.name.split('.').pop() || 'pdf').toLowerCase()
        // jeśli tylko jeden plik i podano własną nazwę – użyj jej
        const base = (picked.length === 1 && customName.trim())
          ? slugify(customName.trim())
          : slugify(f.name.replace(/\.[^.]+$/, ''))

        const path = `${weddingId}/${base}.${ext}`

        const { error: upErr } = await supabase.storage.from('pdf').upload(path, f, {
          upsert: overwrite,
          contentType: f.type || (ext === 'pdf' ? 'application/pdf' : undefined),
        })
        if (upErr) {
          // typowy błąd kolizji nazwy, gdy upsert=false
          throw new Error(upErr.message.includes('already exists')
            ? `Plik "${base}.${ext}" już istnieje (odznacz/oznacz "Nadpisz" albo zmień nazwę).`
            : upErr.message)
        }
      }

      // wyczyść stan + odśwież listę
      setPicked([]); setCustomName('')
      await refreshList(weddingId)
    } catch (e:any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
    }
  }

  async function removePlan(path: string) {
    if (!isOrganizer || !weddingId) return
    if (!confirm(`Usunąć plik\n${path.split('/').pop()} ?`)) return
    const res = await fetch('/api/admin/delete-plan-file', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ path })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Nie udało się usunąć pliku'); return }
    await refreshList(weddingId)
  }

  function CurrentPlanView() {
    if (!files.length) return <p className="text-slate-600">Brak opublikowanych plików.</p>
    return (
      <ul className="list-disc ml-5 space-y-1">
        {files.map(f => (
          <li key={f.path}>
            <a className="underline" href={f.url} target="_blank" rel="noreferrer">
              {f.path.split('/').pop()}
            </a>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plan stołów</h1>

      <div className="card">
        <div className="card-pad">
          <h2 className="text-lg font-semibold mb-2">Pliki dostępne dla gości</h2>
          <CurrentPlanView />
        </div>
      </div>

      {isOrganizer && (
        <>
          {/* Podgląd układu z bazy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tables.map((t) => {
              const guestsOfTable = assign
                .filter((a) => a.table_id === t.id)
                .map((a) => guests.find((g) => g.id === a.guest_id)?.full_name || '???')
              return (
                <div key={t.id} className="border rounded p-3 bg-white">
                  <h2 className="font-semibold mb-2">{t.name}</h2>
                  <ul className="list-disc ml-5">
                    {guestsOfTable.map((g, j) => <li key={j}>{g}</li>)}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Akcje organizatora */}
          <div className="flex flex-wrap items-center gap-4">
            <PDFDownloadLink
              document={<SeatingPDF tables={tables.map(tt => ({
                name: tt.name,
                guests: assign.filter(a => a.table_id === tt.id)
                  .map(a => guests.find(g => g.id === a.guest_id)?.full_name || '???')
              }))} />}
              fileName="plan-stolow.pdf"
              className="underline"
            >
              Pobierz PDF lokalnie
            </PDFDownloadLink>

            <button className="btn" onClick={generateAndUpload}>
              Zapisz PDF do chmury (Supabase)
            </button>

            {/* NOWE: multi-upload + własna nazwa */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-sm">lub wgraj własny plik(i):</span>
                <input type="file" accept="application/pdf,image/*" multiple onChange={onPick} />
                <button
                  className="btn disabled:opacity-50"
                  onClick={uploadPicked}
                  disabled={!picked.length || uploading}
                >
                  {uploading ? 'Wgrywam…' : 'Wgraj'}
                </button>
              </div>
              <div className="text-xs text-slate-600">
                Wybrano: {picked.length || 0} plik(ów)
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-700">Nazwa pliku (gdy wybrano 1):</label>
                <input
                  className="border rounded p-1 text-sm"
                  value={customName}
                  onChange={e=>setCustomName(e.target.value)}
                  placeholder="np. plan-sala-wejscie"
                  disabled={picked.length !== 1}
                />
                <label className="text-sm inline-flex items-center gap-2 ml-2">
                  <input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)} />
                  Nadpisz, jeśli istnieje
                </label>
              </div>
            </div>
          </div>

          {/* lista z przyciskiem Usuń */}
          {!!files.length && (
            <div>
              <h3 className="mt-4 font-semibold">Twoje pliki w chmurze:</h3>
              <ul className="divide-y">
                {files.map(f => (
                  <li key={f.path} className="py-2 flex items-center justify-between gap-2">
                    <a className="underline" href={f.url} target="_blank" rel="noreferrer">
                      {f.path.split('/').pop()}
                    </a>
                    <button className="btn" onClick={()=>removePlan(f.path)}>Usuń</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {signedUrl && (
            <a href={signedUrl} className="underline block" target="_blank" rel="noreferrer">
              Pobierz zapisany plik (link czasowy)
            </a>
          )}
        </>
      )}

      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
