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

  const [signedUrl, setSignedUrl] = useState<string | null>(null) // wynik zapisu/generowania dla organizatora
  const [currentPlans, setCurrentPlans] = useState<PlanLink[]>([]) // to, co ma zobaczyć każdy
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      // dane do podglądu układu (przydadzą się organizatorowi)
      const { data: t } = await supabase.from('tables').select('id,name').order('name')
      const { data: a } = await supabase.from('table_assignments').select('table_id,guest_id')
      const { data: g } = await supabase.from('guests').select('id,full_name').order('full_name')
      setTables(t ?? []); setAssign(a ?? []); setGuests(g ?? [])

      // rola
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: r } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(r?.role === 'organizer')
      }

      // wczytaj link(i) do aktualnego planu (dla wszystkich)
      if (wid) await loadCurrentPlanLinks(wid)
    })().catch((e) => setErr(String(e)))
  }, [])

  const model = useMemo(() => {
    return tables.map((t) => ({
      name: t.name,
      guests: assign
        .filter((a) => a.table_id === t.id)
        .map((a) => guests.find((g) => g.id === a.guest_id)?.full_name || '???'),
    }))
  }, [tables, assign, guests])

  async function loadCurrentPlanLinks(wid: string) {
    // Najpierw spróbuj „standardowych” nazw
    const candidates = [
      `${wid}/plan-stolow-custom.pdf`,
      `${wid}/plan-stolow.pdf`,
      `${wid}/plan-stolow.png`,
      `${wid}/plan-stolow.jpg`,
      `${wid}/plan-stolow.jpeg`,
    ]
    const found: PlanLink[] = []

    for (const p of candidates) {
      const { data } = await supabase.storage.from('pdf').createSignedUrl(p, 60 * 10)
      if (data?.signedUrl) found.push({ path: p, url: data.signedUrl })
    }

    // Jeśli nic nie znaleziono – pokaż wszystko co jest w folderze wesela
    if (found.length === 0) {
      const { data: list } = await supabase.storage.from('pdf').list(wid, { limit: 100 })
      for (const obj of list ?? []) {
        const path = `${wid}/${obj.name}`
        const { data } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
        if (data?.signedUrl) found.push({ path, url: data.signedUrl })
      }
    }

    setCurrentPlans(found)
  }

  /** Generuj PDF na froncie i zapisz w bucketcie `pdf` (tylko organizator) */
  async function generateAndUpload() {
    setErr(null)
    if (!isOrganizer) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }

    const { pdf } = await import('@react-pdf/renderer')
    const doc = <SeatingPDF tables={model} />
    const blob = await pdf(doc).toBlob()

    const path = `${weddingId}/plan-stolow.pdf`
    const { error: upErr } = await supabase.storage.from('pdf').upload(path, blob, {
      upsert: true,
      contentType: 'application/pdf',
    })
    if (upErr) { setErr(upErr.message); return }

    const { data, error } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
    if (error || !data) { setErr(error?.message || 'Nie udało się utworzyć linku.'); return }

    setSignedUrl(data.signedUrl)
    await loadCurrentPlanLinks(weddingId) // odśwież widok „aktualny plan”
  }

  /** Wgraj własny plik (PDF/obraz) – tylko organizator */
  async function uploadOwn(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!isOrganizer) { setErr('Tylko organizator może wgrywać pliki.'); return }
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }

    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `${weddingId}/plan-stolow-custom.${ext}`

      const { error: upErr } = await supabase.storage.from('pdf').upload(path, file, {
        upsert: true,
        contentType: file.type || (ext === 'pdf' ? 'application/pdf' : undefined),
      })
      if (upErr) throw upErr

      const { data, error: sErr } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
      if (sErr || !data) throw new Error(sErr?.message || 'Nie udało się utworzyć linku.')
      setSignedUrl(data.signedUrl)
      await loadCurrentPlanLinks(weddingId)
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
      e.currentTarget.value = ''
    }
  }

  /** Widok tylko do wyświetlenia aktualnego planu (dla gościa) */
  function CurrentPlanView() {
    if (!currentPlans.length) {
      return <p className="text-slate-600">Brak opublikowanego planu stołów.</p>
    }
    // bierzemy pierwszy jako „aktualny”
    const primary = currentPlans[0]
    return (
      <div className="space-y-2">
        <a href={primary.url} target="_blank" className="underline">Zobacz / pobierz aktualny plan</a>
        {currentPlans.length > 1 && (
          <div className="text-xs text-slate-600">
            Dostępne także:
            <ul className="list-disc ml-5">
              {currentPlans.slice(1).map((p) => (
                <li key={p.path}><a className="underline" href={p.url} target="_blank">{p.path.split('/').pop()}</a></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plan stołów</h1>

      {/* Sekcja zawsze widoczna – link do aktualnego planu */}
      <div className="card">
        <div className="card-pad">
          <h2 className="text-lg font-semibold mb-2">Aktualny plan</h2>
          <CurrentPlanView />
        </div>
      </div>

      {/* Dalsze sekcje tylko dla organizatora */}
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

            <label className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-600">lub wgraj własny plik:</span>
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={uploadOwn}
                disabled={uploading}
              />
            </label>
          </div>

          {signedUrl && (
            <a href={signedUrl} className="underline block" target="_blank">
              Pobierz zapisany plik (link czasowy)
            </a>
          )}
        </>
      )}

      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
    
  )
}
