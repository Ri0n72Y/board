import { cn } from '../../lib/cn'

interface MarkdownPreviewProps {
  content: string | null
  isLoading?: boolean
  error?: string | null
  emptyMessage?: string
  loadingMessage?: string
  maxHeight?: string
}

export function MarkdownPreview({
  content,
  isLoading = false,
  error = null,
  emptyMessage = 'No content',
  loadingMessage = 'Loading preview...',
  maxHeight = 'max-h-96',
}: MarkdownPreviewProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        {loadingMessage}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid gap-1 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        <strong>Preview failed</strong>
        <span>{error}</span>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <pre
      className={cn(
        'min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-50',
        maxHeight,
      )}
    >
      {content}
    </pre>
  )
}
