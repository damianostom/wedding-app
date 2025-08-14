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

export default function TablesPage() {
  const supabase = supaClient()
  const [tables, setTables] = useState<Table[]>([])
  const [assign, setAssign] = useState<Assigned[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [weddingId, setWeddingId] = useState<string | null>(null)

  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<PlanLink[]>([])  // ← wszystkie pliki w folderze
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [picked, setPicked] = useState<File | null>(null) // ← wybrany plik, czeka na „Wgraj”

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

  /** wczytaj WSZYSTKIE pliki z folderu wesela */
  async function refreshList(wid: string) {
    const { data: list, error } = await supabase.storage.from('pdf').list(wid, { limit: 100 })
    if (error) { setErr(error.message); return }
    const out: PlanLink[] = []
    for (const obj of list ?? []) {
      const path = `${wid}/${obj.name}`
      const { data: s } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
      if (s?.signedUrl) out.push({ path, url: s.signedUrl })
    }
    // sort: najnowsze pliki wyżej
    out.sort((a, b) => a.path.localeCompare(b.path)).reverse()
    setFiles(out)
  }

  /** generuj PDF na podstawie danych z bazy */
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
    await refreshList(weddingId)
  }

  /** wybór pliku -> tylko zapamiętuję */
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    setPicked(e.target.files?.[0] ?? null)
  }

  /** „Wgraj” kliknięte – upload wybranego pliku */
  async function uploadPicked() {
    if (!picked) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }
    setUploading(true)
    try {
      const ext = (picked.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `${weddingId}/plan-stolow-custom.${ext}`
      const { error: upErr } = await supabase.storage.from('pdf').upload(path, picked, {
        upsert: true,
        contentType: picked.type || (ext === 'pdf' ? 'application/pdf' : undefined),
      })
      if (upErr) throw upErr
      const { data } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
      setSignedUrl(data?.signedUrl || null)
      setPicked(null)
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

  /** widok dla gości – lista linków do wszystkich plików */
  function CurrentPlanView() {
    if (!files.length) return <p className="text-slate-600">Brak opublikowanych plików.</p>
    return (
      <ul className="list-disc ml-5 space-y-1">
        {files.map(f => (
          <li key={f.path}>
            <a className="underline" href={f.url} target="_blank">{f.path.split('/').pop()}</a>
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
            {model.map((t, i) => (
              <div key={i} className="border rounded p-3 bg-white">
                <h2 className="font-semibold mb-2">{t.name}</h2>
                <ul className="list-disc ml-5">
                  {t.guests.map((g, j) => <li key={j}>{g}</li>)}
                </ul>
              </div>
            ))}
          </div>

          {/* Akcje organizatora */}
          <div className="flex flex-wrap items-center gap-4">
            <PDFDownloadLink
              document={<SeatingPDF tables={model} />}
              fileName="plan-stolow.pdf"
              className="underline"
            >
              Pobierz PDF lokalnie
            </PDFDownloadLink>

            <button className="btn" onClick={generateAndUpload}>
              Zapisz PDF do chmury (Supabase)
            </button>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 text-sm">lub wgraj własny plik:</span>
              <input type="file" accept="application/pdf,image/*" onChange={onPick} />
              <button className="btn disabled:opacity-50" onClick={uploadPicked} disabled={!picked || uploading}>
                {uploading ? 'Wgrywam…' : 'Wgraj'}
              </button>
            </div>
          </div>

          {/* lista z przyciskiem Usuń */}
          {!!files.length && (
            <div>
              <h3 className="mt-4 font-semibold">Twoje pliki w chmurze:</h3>
              <ul className="divide-y">
                {files.map(f => (
                  <li key={f.path} className="py-2 flex items-center justify-between gap-2">
                    <a className="underline" href={f.url} target="_blank">{f.path.split('/').pop()}</a>
                    <button className="btn" onClick={()=>removePlan(f.path)}>Usuń</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {signedUrl && (
            <a href={signedUrl} className="underline block" target="_blank">Pobierz zapisany plik (link czasowy)</a>
          )}
        </>
      )}

      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
