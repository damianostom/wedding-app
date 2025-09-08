'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="min-h-screen wedding-bg">
        <div className="mx-auto max-w-md p-6">
          <h1 className="text-xl font-bold mb-2">Ups, coś poszło nie tak</h1>
          <p className="text-sm text-red-600 break-words">
            {error?.message || 'Nieoczekiwany błąd.'}
          </p>
          <button className="btn mt-4" onClick={() => reset()}>
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  )
}
