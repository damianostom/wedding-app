'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { PDFDownloadLink, pdf } from '@react-pdf/renderer'
import { SeatingPDF } from '@/components/SeatingPDF'
import { useEffect, useMemo, useState } from 'react'

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

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)
      const { data: t } = await supabase.from('tables').select('id,name').order('name')
      const { data: a } = await supabase.from('table_assignments').select('table_id,guest_id')
      const { data: g } = await supabase.from('guests').select('id,full_name').order('full_name')
      setTables(t ?? []); setAssign(a ?? []); setGuests(g ?? [])
    })()
  }, [])

  const model = useMemo(() => {
    return tables.map(t => ({
      name: t.name,
      guests: assign.filter(a=>a.table_id===t.id).map(a=>guests.find(g=>g.id===a.guest_id)?.full_name || '???')
    }))
  }, [tables, assign, guests])

  async function generateAndUpload() {
    if (!weddingId) return
    const doc = <SeatingPDF tables={model} />
    const blob = await pdf(doc).toBlob()
    const path = `${weddingId}/plan-stolow.pdf`
    const { error: upErr } = await supabase.storage.from('pdf').upload(path, blob, { upsert: true, contentType: 'application/pdf' })
    if (upErr) { alert(upErr.message); return }
    const { data, error } = await supabase.storage.from('pdf').createSignedUrl(path, 60 * 10) // 10 min
    if (error) { alert(error.message); return }
    setSignedUrl(data.signedUrl)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plan stołów</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {model.map((t, i) => (
          <div key={i} className="border rounded p-3">
            <h2 className="font-semibold mb-2">{t.name}</h2>
            <ul className="list-disc ml-5">
              {t.guests.map((g, j) => <li key={j}>{g}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <PDFDownloadLink document={<SeatingPDF tables={model} />} fileName="plan-stolow.pdf" className="underline">
          Pobierz PDF lokalnie
        </PDFDownloadLink>
        <button className="bg-black text-white px-4 py-2 rounded" onClick={generateAndUpload}>
          Zapisz PDF do chmury (Supabase)
        </button>
      </div>

      {signedUrl && <a href={signedUrl} className="underline block" target="_blank">Pobierz zapisany PDF (link czasowy)</a>}
    </div>
  )
}
