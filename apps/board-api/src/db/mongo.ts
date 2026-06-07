import { MongoClient, type Collection, type Db, type Document } from 'mongodb'

let client: MongoClient | undefined

export type BoardCollectionName = 'records' | 'snapshots' | 'profiles' | 'agent_drafts' | 'agent_responses'

export async function getMongoClient(uri: string): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
  }

  return client
}

export async function getMongoDatabase(
  uri: string,
  databaseName: string
): Promise<Db> {
  return (await getMongoClient(uri)).db(databaseName)
}

export async function getBoardCollection<T extends Document>(
  uri: string,
  databaseName: string,
  collectionName: string
): Promise<Collection<T>> {
  const database = await getMongoDatabase(uri, databaseName)
  return database.collection<T>(collectionName)
}

export async function getRecordsCollection<T extends Document>(
  uri: string,
  databaseName = process.env.MONGODB_DB ?? 'labour_board'
): Promise<Collection<T>> {
  const collection = await getBoardCollection<T>(uri, databaseName, 'records')
  await collection.createIndex({ id: 1 }, { unique: true })
  await collection.createIndex({ pid: 1 })
  return collection
}

export async function getSnapshotsCollection<T extends Document>(
  uri: string,
  databaseName = process.env.MONGODB_DB ?? 'labour_board'
): Promise<Collection<T>> {
  const collection = await getBoardCollection<T>(uri, databaseName, 'snapshots')
  await collection.createIndex({ kind: 1 }, { unique: true })
  return collection
}

export async function getProfilesCollection<T extends Document>(
  uri: string,
  databaseName = process.env.MONGODB_DB ?? 'labour_board'
): Promise<Collection<T>> {
  const collection = await getBoardCollection<T>(uri, databaseName, 'profiles')
  await collection.createIndex({ pk: 1 }, { unique: true })
  return collection
}

export async function getAgentDraftsCollection<T extends Document>(
  uri: string,
  databaseName = process.env.MONGODB_DB ?? 'labour_board'
): Promise<Collection<T>> {
  const collection = await getBoardCollection<T>(uri, databaseName, 'agent_drafts')
  await collection.createIndex({ kind: 1 })
  await collection.createIndex({ id: 1 }, { unique: true })
  return collection
}

export async function getAgentResponsesCollection<T extends Document>(
  uri: string,
  databaseName = process.env.MONGODB_DB ?? 'labour_board'
): Promise<Collection<T>> {
  const collection = await getBoardCollection<T>(uri, databaseName, 'agent_responses')
  await collection.createIndex({ kind: 1 })
  await collection.createIndex({ id: 1 }, { unique: true })
  await collection.createIndex({ draftId: 1 })
  return collection
}
