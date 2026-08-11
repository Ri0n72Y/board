import { useMemo, useRef, useState } from 'react'
import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn'

const MAX_RESULTS = 20

function recordSearchText(record: RecordResponse<RecordItem<RecordBody>>) {
  const body = record.body
  const values = [body.pid, body.id, ...body.tags, body.assignee ?? '']
  if (body.body && typeof body.body === 'object') {
    const inner = body.body as Record<string, unknown>
    values.push(typeof inner.title === 'string' ? inner.title : '')
    values.push(typeof inner.description === 'string' ? inner.description : '')
    values.push(typeof inner.content === 'string' ? inner.content : '')
  }
  return values.filter((value): value is string => typeof value === 'string')
}

function recordTitle(record: RecordResponse<RecordItem<RecordBody>>) {
  const body = record.body.body as Record<string, unknown> | undefined
  return typeof body?.title === 'string' ? body.title : record.body.pid
}

function statusTagOf(record: RecordResponse<RecordItem<RecordBody>>) {
  return record.body.tags.find((tag) => tag.startsWith('status:'))
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  records: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

export function CommandPalette({
  open,
  onClose,
  records,
  onOpenRecord,
}: CommandPaletteProps) {
  return (
    <Transition appear show={open} as="div">
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as="div"
          enter="ease-out duration-150 motion-reduce:transition-none"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100 motion-reduce:transition-none"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/30" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-start justify-center pt-[12vh]">
          <TransitionChild
            as="div"
            enter="ease-out duration-150 motion-reduce:transition-none"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100 motion-reduce:transition-none"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-[36rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
              {/*
                key={open ? 'open' : 'closed'} remounts the panel body every
                time the palette opens, so query/activeIndex reset without
                synchronously calling setState in an effect.
              */}
              <CommandPalettePanel
                key={open ? 'open' : 'closed'}
                records={records}
                onOpenRecord={onOpenRecord}
                onClose={onClose}
              />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}

function CommandPalettePanel({
  records,
  onOpenRecord,
  onClose,
}: {
  records: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return records.slice(0, MAX_RESULTS)
    return records
      .filter((record) =>
        recordSearchText(record).some((value) =>
          value.toLowerCase().includes(q)
        )
      )
      .slice(0, MAX_RESULTS)
  }, [query, records])

  const select = (index: number) => {
    const record = results[index]
    if (!record) return
    onOpenRecord(record)
    onClose()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(results.length - 1, 0))
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      // Ignore Enter while an IME composition is in flight (e.g. Chinese
      // pinyin confirm), otherwise we'd open a record mid-composition.
      if (event.nativeEvent.isComposing) return
      event.preventDefault()
      const index =
        activeIndex >= 0 && activeIndex < results.length ? activeIndex : 0
      select(index)
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Search input */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <MagnifyingGlassIcon
          className="h-5 w-5 shrink-0 text-slate-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-results"
          aria-activedescendant={
            results[activeIndex]
              ? `command-result-${results[activeIndex].body.id}`
              : undefined
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('commandPalette.placeholder')}
          autoComplete="off"
          autoFocus
          spellCheck={false}
          className="h-8 w-full bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Results */}
      <div
        id="command-palette-results"
        role="listbox"
        className="max-h-[45vh] overflow-y-auto overscroll-behavior-contain p-1.5"
      >
        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500">
            {t('commandPalette.noResults')}
          </p>
        ) : (
          results.map((record, index) => {
            const statusTag = statusTagOf(record)
            return (
              <button
                key={record.body.id}
                id={`command-result-${record.body.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => select(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex w-full items-baseline gap-3 rounded-md px-3 py-2 text-left',
                  index === activeIndex
                    ? 'bg-slate-100'
                    : 'hover:bg-slate-50'
                )}
              >
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {record.body.pid}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                  {recordTitle(record)}
                </span>
                {statusTag && (
                  <span className="shrink-0 text-xs text-slate-500">
                    {statusTag}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer hint */}
      <footer className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400">
        {t('commandPalette.hint')}
      </footer>
    </div>
  )
}
