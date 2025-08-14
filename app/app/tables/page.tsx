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

type Table   = { id: string; name: string }
type Assigned= { table_id: string; guest_id: string }
type Guest   = { id: string; full_name: string }

type PlanLink = { path: string; url: string }

export default function TablesPage() {
  const supabase = supaClient()
  const [tables, setTables] = useState<Table[]>([])
  const [assign, setAssign] = useState<Assigned[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [weddingId, setWeddingId] = useState<string | null>(null)

  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [currentPlans, setCurrentPlans] = useState<PlanLink[]>([])   // publikowane (A/B + fallback)
  const [allFiles, setAllFiles] = useState<string[]>([])             // wszystko w folderze wesela (dla admina)

  const [slot, setSlot] = useState<'A' | 'B'>('A')                   // gdzie zapisać: Plan A / Plan B
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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

      if (wid) {
        await loadCurrentPlanLinks(wid)
        await refreshAllFiles(wid)
      }
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

  async function refreshAllFiles(wid: string) {
    const { data: list } = await supabase.storage.from('pdf').list(wid, { limit: 100 })
    setAllFiles((list ?? []).map(o => `${wid}/${o.name}`))
  }

  async function loadCurrentPlanLinks(wid: string) {
    // Priorytet: Plan A, potem Plan B (różne rozszerzenia)
    const A = [`${wid}/plan-stolow-A.pdf`, `${wid}/plan-stolow-A.png`, `${wid}/plan-stolow-A.jpg`, `${wid}/plan-stolow-A.jpeg`]
    const B = [`${wid}/plan-stolow-B.pdf`, `${wid}/plan-stolow-B.png`, `${wid}/plan-stolow-B.jpg`, `${wid}/plan-stolow-B.jpeg`]
    const fallback = [
      `${wid}/plan-stolow-custom.pdf`,
      `${wid}/plan-stolow.pdf`,
      `${wid}/plan-stolow.png`,
      `${wid}/plan-stolow.jpg`,
      `${wid}/plan-stolow.jpeg`,
    ]

    const found: PlanLink[] = []
    for (const p of [...A, ...B, ...fallback]) {
      const { data } = await supabase.storage.from('pdf').createSignedUrl(p, 60 * 10)
      if (data?.signedUrl) found.push({ path: p, url: data.signedUrl })
    }
    // usuń duplikaty tej samej bazowej nazwy (gdy istnieje kilka rozszerzeń)
    const dedup: PlanLink[] = []
    const seen = new Set<string>()
    for (const f of found) {
      const key = f.path.replace(/\.(pdf|png|jpe?g)$/i, '')
      if (!seen.has(key)) { dedup.push(f); seen.add(key) }
    }
    setCurrentPlans(dedup.slice(0, 2)) // pokazuj max 2 (A i B, jeśli są)
  }

  async function generateAndUpload() {
    setErr(null)
    if (!isOrganizer) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }

    const { pdf } = await import('@react-pdf/renderer')
    const doc = <SeatingPDF tables={model} />
    const blob = await pdf(doc).toBlob()

    const path = `${weddingId}/plan-stolow-${slot}.pdf`
    const { error: upErr } = await supabase.storage.from('pdf').upload(path, blob, {
      upsert: true, contentType: 'application/pdf',
    })
    if (upErr) { setErr(upErr.message); return }

    const { data, error } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
    if (error || !data) { setErr(error?.message || 'Nie udało się utworzyć linku.'); return }

    setSignedUrl(data.signedUrl)
    await loadCurrentPlanLinks(weddingId)
    await refreshAllFiles(weddingId)
  }

  async function uploadOwn(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!isOrganizer) { setErr('Tylko organizator może wgrywać pliki.'); return }
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }

    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `${weddingId}/plan-stolow-${slot}.${ext}`

      const { error: upErr } = await supabase.storage.from('pdf').upload(path, file, {
        upsert: true,
        contentType: file.type || (ext === 'pdf' ? 'application/pdf' : undefined),
      })
      if (upErr) throw upErr

      const { data, error: sErr } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
      if (sErr || !data) throw new Error(sErr?.message || 'Nie udało się utworzyć linku.')
      setSignedUrl(data.signedUrl)
      await loadCurrentPlanLinks(weddingId)
      await refreshAllFiles(weddingId)
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
      e.currentTarget.value = ''
    }
  }

  async function deletePlan(path: string) {
    if (!confirm(`Usunąć plik: ${path.split('/').pop()} ?`)) return
    const res = await fetch('/api/admin/delete-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { alert(j.error || 'Nie udało się usunąć pliku'); return }
    if (weddingId) {
      await loadCurrentPlanLinks(weddingId)
      await refreshAllFiles(weddingId)
    }
  }

  function CurrentPlanView() {
    if (!currentPlans.length) {
      return <p className="text-slate-600">Brak opublikowanego planu stołów.</p>
    }
    return (
      <div className="space-y-2">
        <div className="text-sm text-slate-600">Wybierz plan do podglądu/pobrania:</div>
        <ul className="list-disc ml-5">
          {currentPlans.map((p) => (
            <li key={p.path}>
              <a className="underline" href={p.url} target="_blank">
                {p.path.includes('-A.') ? 'Plan A' : p.path.includes('-B.') ? 'Plan B' : p.path.split('/').pop()}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plan stołów</h1>

      {/* Sekcja widoczna dla wszystkich */}
      <div className="card">
        <div className="card-pad">
          <h2 className="text-lg font-semibold mb-2">Aktualny plan</h2>
          <CurrentPlanView />
        </div>
      </div>

      {/* Panel organizatora */}
      {isOrganizer && (
        <>
          {/* Podgląd układu z bazy (dla generatora PDF) */}
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <PDFDownloadLink
                document={<SeatingPDF tables={model} />}
                fileName="plan-stolow.pdf"
                className="underline"
              >
                Pobierz PDF lokalnie
              </PDFDownloadLink>

              <div className="inline-flex items-center gap-3">
                <span className="text-sm text-slate-600">Zapisz jako:</span>
                <label className="inline-flex items-center gap-1 text-sm">
                  <input type="radio" checked={slot === 'A'} onChange={() => setSlot('A')} />
                  Plan A
                </label>
                <label className="inline-flex items-center gap-1 text-sm">
                  <input type="radio" checked={slot === 'B'} onChange={() => setSlot('B')} />
                  Plan B
                </label>
              </div>

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
          </div>

          {/* Lista wszystkich plików w folderze wesela (kasowanie) */}
          <div className="card">
            <div className="card-pad">
              <h3 className="font-semibold mb-2">Pliki w chmurze (folder PDF)</h3>
              {!allFiles.length ? (
                <div className="text-sm text-slate-600">Brak plików.</div>
              ) : (
                <ul className="divide-y">
                  {allFiles.map(p => (
                    <li key={p} className="py-2 flex items-center justify-between gap-3">
                      <span className="truncate">{p.split('/').pop()}</span>
                      <div className="flex items-center gap-2">
                        <a className="underline text-sm" href={(supabase.storage.from('pdf').getPublicUrl(p).data.publicUrl)} target="_blank">Podgląd</a>
                        <button className="btn" onClick={() => deletePlan(p)}>Usuń</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
