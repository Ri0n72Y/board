import type { ParsedTag, Tag, TagDefinition } from '../interfaces/tag.js'

function splitNamespaced(raw: string): [string, string] | null {
  const separatorIndex = raw.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
    return null
  }

  return [raw.slice(0, separatorIndex), raw.slice(separatorIndex + 1)]
}

export function isTag(raw: string): raw is Tag {
  return splitNamespaced(raw) !== null
}

export function parseTag(raw: string): ParsedTag | null {
  const parts = splitNamespaced(raw)
  if (!parts) {
    return null
  }

  const [namespace, name] = parts
  return {
    raw: raw as Tag,
    namespace,
    name,
  }
}

export function getTagNamespace(raw: string): string | undefined {
  return parseTag(raw)?.namespace
}

export function getTagName(raw: string): string | undefined {
  return parseTag(raw)?.name
}

export function hasTag(tags: Tag[] | undefined, tag: Tag): boolean {
  return tags?.includes(tag) ?? false
}

export function getTagDisplayName(
  tag: Tag,
  definitions: readonly TagDefinition[] = []
): string {
  return (
    definitions.find((definition) => definition.id === tag)?.displayName ??
    getTagName(tag) ??
    tag
  )
}
