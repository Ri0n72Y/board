import { MongoClient, type Collection, type Db, type Document } from 'mongodb'

let client: MongoClient | undefined

export type BoardCollectionName = 'records' | 'snapshots' | 'profiles'

export async function getMongoDatabase(
  uri: string,
  databaseName: string
): Promise<Db> {
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
  }

  return client.db(databaseName)
}

export async function getBoardCollection<T extends Document>(
  uri: string,
  databaseName: string,
  collectionName: BoardCollectionName
): Promise<Collection<T>> {
  const database = await getMongoDatabase(uri, databaseName)
  return database.collection<T>(collectionName)
}

export async function getRecordsCollection<T extends Document>(
  uri: string,
  databaseName = process.env.MONGODB_DB ?? 'labour_board'
): Promise<Collection<T>> {
  return getBoardCollection<T>(uri, databaseName, 'records')
}

export async function getProfilesCollection<T extends Document>(
  uri: string,
  databaseName = process.env.MONGODB_DB ?? 'labour_board'
): Promise<Collection<T>> {
  return getBoardCollection<T>(uri, databaseName, 'profiles')
}
