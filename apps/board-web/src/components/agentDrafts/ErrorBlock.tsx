export function ErrorBlock({ title, message }: { title: string; message: string }) {
  return (
    <section className="grid gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  )
}
