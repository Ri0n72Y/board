import type {
  BoardCurrentProjection,
  ProjectionDiagnostic,
} from '@labour-board/shared'
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { Panel } from './ui/Panel'

interface IssuesPanelProps {
  blockedRecords: BoardCurrentProjection['blockedRecords']
  diagnostics: ProjectionDiagnostic[]
}

export function IssuesPanel({
  blockedRecords,
  diagnostics,
}: IssuesPanelProps) {
  if (blockedRecords.length === 0 && diagnostics.length === 0) return null

  return (
    <Panel className="mt-4 border-red-200">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
        Projection Issues
      </h2>

      {diagnostics.length > 0 && (
        <div className="mt-3 grid gap-2">
          <h3 className="text-sm font-semibold text-slate-500">Diagnostics</h3>
          <IssueList
            items={diagnostics.map((diagnostic) => ({
              key: diagnostic.code,
              title: diagnostic.code,
              message: diagnostic.message,
            }))}
          />
        </div>
      )}

      {blockedRecords.length > 0 && (
        <div className="mt-3 grid gap-2">
          <h3 className="text-sm font-semibold text-slate-500">
            Blocked records
          </h3>
          {blockedRecords.map((blocked) => (
            <article
              className="grid gap-2 rounded-md bg-red-50 p-3"
              key={blocked.recordId}
            >
              <strong className="break-all text-slate-950">
                {blocked.recordId} · {blocked.status}
              </strong>
              <IssueList
                items={blocked.diagnostics.map((diagnostic, index) => ({
                  key: `${blocked.recordId}:${diagnostic.code}:${index}`,
                  title: diagnostic.code,
                  message: diagnostic.message,
                }))}
              />
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}

function IssueList({
  items,
}: {
  items: { key: string; title: string; message: string }[]
}) {
  return (
    <ul className="grid gap-1.5">
      {items.map((item) => (
        <li className="flex flex-wrap gap-2 break-words text-red-800" key={item.key}>
          <strong>{item.title}</strong>
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  )
}
