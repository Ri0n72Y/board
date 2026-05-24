import { MongoClient, type Collection, type Document } from 'mongodb'

let client: MongoClient | undefined

export async function getRecordsCollection<T extends Document>(
  uri: string
): Promise<Collection<T>> {
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
  }

  const databaseName = process.env.MONGODB_DB ?? 'labour_board'
  return client.db(databaseName).collection<T>('records')
}
