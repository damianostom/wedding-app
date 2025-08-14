'use client'

import dynamic from 'next/dynamic'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { SeatingPDF } from '@/components/SeatingPDF'
import { useEffect, useMemo, useState } from 'react'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(m => m.PDFDownloadLink),
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
  const [customUrl, setCustomUrl] = useState<string | null>(null)
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

      // Jeśli istnieje „ręcznie wgrany” plan – spróbuj znaleźć i zrobić signed URL
      if (wid) {
        const { data: list, error: listErr } = await supabase.storage.from('pdf').list(wid)
        if (!listErr && list && list.length) {
          const item = list.find(f => f.name.startsWith('plan-stolow-custom'))
                 || list.find(f => f.name.startsWith('plan-stolow'))
          if (item) {
            const path = `${wid}/${item.name}`
            const { data: s } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
            if (s) setCustomUrl(s.signedUrl)
          }
        }
      }
    })().catch(e => setErr(String(e)))
  }, []) // mount

  const model = useMemo(() => {
    return tables.map(t => ({
      name: t.name,
      guests: assign.filter(a => a.table_id === t.id).map(a => guests.find(g => g.id === a.guest_id)?.full_name || '???')
    }))
  }, [tables, assign, guests])

  async function generateAndUpload() {
    setErr(null)
    if (!isOrganizer) return
    if (!weddingId) { setErr('Brak powiązania z weselem.'); return }
    const { pdf } = await import('@react-pdf/renderer')
    const doc = <SeatingPDF tables={model} />
    const blob = await pdf(doc).toBlob()
    const path = `${weddingId}/plan-stolow.pdf`
    const { error: upErr } = await supabase.storage.from('pdf').upload(path, blob, {
      upsert: true, contentType: 'application/pdf'
    })
    if (upErr) { setErr(upErr.message); return }
    const { data, error } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
    if (error) { setErr(error.message); return }
    setSignedUrl(data.signedUrl)
  }

  async function uploadCustom(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !weddingId) return
    setUploading(true); setErr(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const path = `${weddingId}/plan-stolow-custom.${ext}`
    const { error: upErr } = await supabase.storage.from('pdf').upload(path, file, {
      upsert: true, contentType: file.type || (ext === 'pdf' ? 'application/pdf' : undefined)
    })
    if (upErr) { setErr(upErr.message); setUploading(false); return }
    const { data } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10)
    setCustomUrl(data?.signedUrl || null)
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plan stołów</h1>

      <p className="text-slate-600">
        Masz dwie opcje:
        <br/>• <strong>Pobierz PDF lokalnie</strong> – automatycznie generowany z bazy.
        <br/>• <strong>Wgraj gotowy plik (PDF/JPG/PNG)</strong> – np. własny projekt.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <PDFDownloadLink
          document={<SeatingPDF tables={model} />}
          fileName="plan-stolow.pdf"
          className="underline"
        >
          Pobierz PDF lokalnie
        </PDFDownloadLink>

        {isOrganizer && (
          <button className="btn" onClick={generateAndUpload}>
            Zapisz PDF do chmury (Supabase)
          </button>
        )}
      </div>

      {signedUrl && (
        <p>
          <a href={signedUrl} className="underline" target="_blank">Pobierz zapisany PDF (link czasowy)</a>
        </p>
      )}

      <hr className="my-4"/>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Wgraj gotowy plik z planem</h2>
        {isOrganizer ? (
          <>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={uploadCustom}
              disabled={uploading || !weddingId}
            />
            {uploading && <p className="text-slate-600 text-sm">Wysyłam…</p>}
          </>
        ) : (
          <p className="text-slate-600">Tę sekcję widzi tylko organizator.</p>
        )}

        {customUrl && (
          <p>
            Aktualny wgrany plan: <a href={customUrl} target="_blank" className="underline">Otwórz</a>
          </p>
        )}
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  )
}
