export type Tag = `${string}:${string}`;

export interface ParsedTag {
  raw: Tag;
  namespace: string;
  name: string;
}

export interface TagNamespaceConfig {
  id: string;
  displayName?: string;
  locked?: boolean;
}

export interface TagDefinition {
  id: Tag;
  displayName?: string;
  locked?: boolean;
}
