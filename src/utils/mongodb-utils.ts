import { ChangeStreamNameSpace, Collection, MongoClient } from "mongodb";

export function getCollection(mongoClient: MongoClient, collectionNamespace: ChangeStreamNameSpace) {
    const { db, coll } = collectionNamespace;
    return mongoClient.db(db).collection(coll);
}

export function getNamespace(collection: Collection): ChangeStreamNameSpace {
    const { dbName, collectionName } = collection;
    return { db: dbName, coll: collectionName };
}
