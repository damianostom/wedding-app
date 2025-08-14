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

export default function TablesPage() {
  const supabase = supaClient()
  const [tables, setTables] = useState<Table[]>([])
  const [assign, setAssign] = useState<Assigned[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [weddingId, setWeddingId] = useState<string | null>(null)

  const [signedUrl, setSignedUrl] = useState<string | null>(null)
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
      setTables(t ?? [])
      setAssign(a ?? [])
      setGuests(g ?? [])

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: r } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(r?.role === 'organizer')
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

  /** Generuj PDF na froncie i zapisz go w bucketcie `pdf` (tylko organizer) */
  async function generateAndUpload() {
    setErr(null)
    if (!isOrganizer) return
    if (!weddingId) {
      setErr('Brak powiązania z weselem.')
      return
    }

    const { pdf } = await import('@react-pdf/renderer')
    const doc = <SeatingPDF tables={model} />
    const blob = await pdf(doc).toBlob()

    const path = `${weddingId}/plan-stolow.pdf`
    const { error: upErr } = await supabase.storage.from('pdf').upload(path, blob, {
      upsert: true,
      contentType: 'application/pdf',
    })
    if (upErr) {
      setErr(upErr.message)
      return
    }

    const { data, error } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
    if (error || !data) {
      setErr(error?.message || 'Nie udało się utworzyć linku do pobrania.')
      return
    }
    setSignedUrl(data.signedUrl)
  }

  /** Wgraj własny plik (PDF/obraz) z dysku i zapisz w bucketcie `pdf` (tylko organizer) */
  async function uploadOwn(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!isOrganizer) {
      setErr('Tylko organizator może wgrywać pliki.')
      return
    }
    if (!weddingId) {
      setErr('Brak powiązania z weselem.')
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'bin'
      const path = `${weddingId}/plan-stolow.${ext}`

      const { error: upErr } = await supabase.storage.from('pdf').upload(path, file, {
        upsert: true,
        contentType: file.type || (ext === 'pdf' ? 'application/pdf' : undefined),
      })
      if (upErr) throw upErr

      const { data, error: sErr } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
      if (sErr || !data) {
        throw new Error(sErr?.message || 'Nie udało się utworzyć linku do pobrania.')
      }
      setSignedUrl(data.signedUrl)
    } catch (e: any) {
      setErr(e?.message || 'Błąd wgrywania')
    } finally {
      setUploading(false)
      // wyczyść input
      e.currentTarget.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plan stołów</h1>

      {/* Podgląd układu (z bazy) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {model.map((t, i) => (
          <div key={i} className="border rounded p-3">
            <h2 className="font-semibold mb-2">{t.name}</h2>
            <ul className="list-disc ml-5">
              {t.guests.map((g, j) => (
                <li key={j}>{g}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Akcje */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Pobierz lokalnie (zawsze dostępne) */}
        <PDFDownloadLink
          document={<SeatingPDF tables={model} />}
          fileName="plan-stolow.pdf"
          className="underline"
        >
          Pobierz PDF lokalnie
        </PDFDownloadLink>

        {/* Zapisy do chmury oraz upload własnego pliku – tylko organizer */}
        {isOrganizer ? (
          <>
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
          </>
        ) : (
          <span className="text-sm text-slate-600">
            Tylko organizator może zapisać/wgrać plan do chmury.
          </span>
        )}
      </div>

      {/* Link czasowy po zapisie/wgraniu */}
      {signedUrl && (
        <a href={signedUrl} target="_blank" className="underline block">
          Pobierz zapisany plik (link czasowy)
        </a>
      )}

      {/* Błędy */}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
