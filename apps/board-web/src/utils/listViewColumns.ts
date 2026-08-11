/**
 * Column definitions for the list view table. Kept in a non-component file so
 * both the table component and tests can import it without react-refresh
 * warnings.
 */

export type ListSortKey =
  | 'pid'
  | 'title'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'createdAt'

export interface ListColumnDef {
  key: ListSortKey
  labelKey: string
  minWidth?: string
}

export const LIST_COLUMNS: ListColumnDef[] = [
  { key: 'pid', labelKey: 'list.pid' },
  { key: 'title', labelKey: 'list.title' },
  { key: 'status', labelKey: 'list.status' },
  { key: 'priority', labelKey: 'list.priority' },
  { key: 'assignee', labelKey: 'list.assignee' },
  { key: 'createdAt', labelKey: 'list.createdAt' },
]
