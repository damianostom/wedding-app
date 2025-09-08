'use client'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Nie udało się załadować panelu</h2>
      <p className="text-sm text-red-600 break-words mt-2">
        {error?.message}
      </p>
      <button className="btn mt-4" onClick={() => reset()}>
        Odśwież
      </button>
    </div>
  )
}
