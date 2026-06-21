/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/boardFilterUrl.devcheck.ts
 */

import type { BoardCurrentFilters } from '../api/boardCurrent'
import {
  DEFAULT_BOARD_CURRENT_FILTERS,
  boardFilterSearchToQuery,
  boardFilterUrlQuery,
  normalizeBoardFilterUrl,
  parseBoardFilterUrl,
} from './boardFilterUrl'

eq(
  boardFilterUrlQuery(DEFAULT_BOARD_CURRENT_FILTERS),
  '',
  'default filters serialize to an empty query',
)

eq(
  boardFilterUrlQuery({ ...DEFAULT_BOARD_CURRENT_FILTERS, q: ' search me ' }),
  'q=search+me',
  'q serializes when non-empty and trims whitespace',
)
eq(
  parseBoardFilterUrl('q=search+me').q,
  'search me',
  'q parses from URLSearchParams encoding',
)

eq(
  boardFilterUrlQuery({
    ...DEFAULT_BOARD_CURRENT_FILTERS,
    tags: ['status:todo', 'priority:high'],
  }),
  'tags=status%3Atodo&tags=priority%3Ahigh',
  'tags serialize as repeatable params',
)
eq(
  parseBoardFilterUrl('tags=status%3Atodo&tags=priority%3Ahigh').tags,
  ['status:todo', 'priority:high'],
  'repeatable tags parse in URL order',
)

eq(
  parseBoardFilterUrl('tag=status%3Atodo&tags=priority%3Ahigh').tags,
  ['status:todo', 'priority:high'],
  'tag compatibility input merges into tags',
)

eq(
  boardFilterUrlQuery({ ...DEFAULT_BOARD_CURRENT_FILTERS, tagMatch: 'any' }),
  'tagMatch=any',
  'tagMatch=any serializes',
)
eq(
  boardFilterUrlQuery({ ...DEFAULT_BOARD_CURRENT_FILTERS, tagMatch: 'all' }),
  '',
  'tagMatch=all is omitted',
)

eq(
  boardFilterUrlQuery({
    ...DEFAULT_BOARD_CURRENT_FILTERS,
    includeArchived: true,
  }),
  'includeArchived=true',
  'includeArchived=true serializes',
)
eq(
  boardFilterUrlQuery({
    ...DEFAULT_BOARD_CURRENT_FILTERS,
    includeArchived: false,
  }),
  '',
  'includeArchived=false is omitted',
)

eq(
  boardFilterUrlQuery({
    ...DEFAULT_BOARD_CURRENT_FILTERS,
    assignee: ' pk1 ',
    assetId: ' asset-1 ',
    relationTarget: ' record-2 ',
  }),
  'assignee=pk1&assetId=asset-1&relationTarget=record-2',
  'assignee, assetId, and relationTarget serialize when non-empty',
)
eq(
  parseBoardFilterUrl(
    'assignee=pk1&assetId=asset-1&relationTarget=record-2',
  ),
  {
    ...DEFAULT_BOARD_CURRENT_FILTERS,
    assignee: 'pk1',
    assetId: 'asset-1',
    relationTarget: 'record-2',
  },
  'assignee, assetId, and relationTarget parse',
)

eq(
  parseBoardFilterUrl(
    'q=%20%20&tags=%20&tags=status%3Atodo&tags=status%3Atodo&assignee=%20',
  ),
  {
    ...DEFAULT_BOARD_CURRENT_FILTERS,
    tags: ['status:todo'],
  },
  'blank values are removed and duplicate tags are deduped',
)

eq(
  parseBoardFilterUrl('tagMatch=bad').tagMatch,
  'all',
  'invalid tagMatch falls back to all',
)
eq(
  parseBoardFilterUrl('includeArchived=false').includeArchived,
  false,
  'includeArchived only parses true as true',
)

const fullFilters: BoardCurrentFilters = {
  q: 'query',
  tags: ['status:todo', 'priority:high'],
  tagMatch: 'any',
  includeArchived: true,
  assignee: 'pk1',
  assetId: 'asset-1',
  relationTarget: 'record-2',
}

eq(
  boardFilterUrlQuery(fullFilters),
  'q=query&tags=status%3Atodo&tags=priority%3Ahigh&tagMatch=any&includeArchived=true&assignee=pk1&assetId=asset-1&relationTarget=record-2',
  'query params serialize in stable order',
)

eq(
  boardFilterSearchToQuery(
    'relationTarget=record-2&tag=status%3Atodo&q=query&includeArchived=true&tagMatch=any&assetId=asset-1&assignee=pk1&tags=priority%3Ahigh',
  ),
  'q=query&tags=status%3Atodo&tags=priority%3Ahigh&tagMatch=any&includeArchived=true&assignee=pk1&assetId=asset-1&relationTarget=record-2',
  'serialize(parse(query)) canonicalizes query order and compatibility params',
)

eq(
  parseBoardFilterUrl(boardFilterUrlQuery(fullFilters)),
  normalizeBoardFilterUrl(fullFilters),
  'parse(serialize(filters)) returns normalized filters',
)

console.log('boardFilterUrl devcheck passed')

function eq<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`,
    )
  }
}
