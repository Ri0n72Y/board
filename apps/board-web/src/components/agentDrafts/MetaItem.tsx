export function MetaItem({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md bg-slate-100 p-2.5">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd
        className={
          mono
            ? 'm-0 break-all font-mono text-xs text-slate-950'
            : 'm-0 wrap-break-word text-slate-950'
        }
      >
        {value}
      </dd>
    </div>
  )
}
