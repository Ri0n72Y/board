export function keyStableTextItems(
  items: string[],
  prefix: string
): { key: string; text: string }[] {
  const seen = new Map<string, number>()
  return items.map((text) => {
    const hash = hashText(text)
    const occurrence = seen.get(hash) ?? 0
    seen.set(hash, occurrence + 1)
    return {
      key: `${prefix}:${hash}:${occurrence}`,
      text,
    }
  })
}

function hashText(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}
