import type { BuiltInSchemaName } from "../constants/schemas.js";
import type { Tag } from "./tag.js";

export type RecordId = string;
export type PublicId = string;
export type PublicKey = string;
export type SchemaName = BuiltInSchemaName | (string & {});
export type AssetRef = RecordId;
export type RelationConstraint = string;

export interface RelationRef {
  constraint: RelationConstraint;
  target: RecordId;
  description?: string;
}

export interface CardBody {
  title: string;
  description?: string;
  content?: string;
  extra?: Record<string, unknown>;
}

export interface AssetBody {
  title: string;
  description?: string;
  content?: string;
  uri?: string;
  extra?: Record<string, unknown>;
}

export type RecordBody = CardBody | AssetBody | Record<string, unknown>;

export interface RecordItem<TBody = RecordBody> {
  id: RecordId;
  pid: PublicId;
  schema: SchemaName;
  tags: Tag[];
  assignee?: PublicKey;
  body: TBody;
  assets?: AssetRef[];
  relations?: RelationRef[];
}
