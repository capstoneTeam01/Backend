const { MongoClient } = require('mongodb')
require('dotenv').config()

main()

async function main() {
   
    const client = new MongoClient(process.env.mongoDBURI)
    await client.connect()  
    await client.close()

    const database = client.db(process.env.DB_NAME)
    const providersCol = database.collection(process.env.COL_NAME)
    const cacheCol = database.collection(process.env.COL_CACHE)

    console.log('\n MongoDb closed')
    

}

//FIXBEE-197