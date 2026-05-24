export const RECORD_SCHEMAS = {
  card: "CardBody",
  asset: "AssetBody",
} as const;

export type BuiltInSchemaName =
  (typeof RECORD_SCHEMAS)[keyof typeof RECORD_SCHEMAS];
