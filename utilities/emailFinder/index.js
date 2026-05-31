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

  const providers = await providersCol.find({
    isDeleted: { $ne: true },
    $and: [
      {
        $or: [
          { businessEmail: { $exists: false } },
          { businessEmail: null },
          { businessEmail: '' }
        ]
      },
      {
        $or: [
          { directWebsiteUrl: { $exists: true, $ne: '' } },
          { websiteUrl: { $exists: true, $ne: '' } },
          { website: { $exists: true, $ne: '' } },
          { websiteDomain: { $exists: true, $ne: '' } }
        ]
      }
    ]
  }).limit(limit).toArray()

  console.log('providers:', providers.length)    

  for (const provider of providers) {
    const website = makeWebsite(provider)
    const domain = makeDomain(website)
    const now = new Date()
    console.log('\nchecking:', provider.businessName)

    const savedCache = await cacheCol.findOne({ domain: domain })
    const cachedEmail = savedCache && (savedCache.email || savedCache.selectedEmail)

      if (cachedEmail) {
      await providersCol.updateOne(
        { _id: provider._id },
        {
          $set: {
            email: cachedEmail,
            businessEmail: cachedEmail,
            emailStatus: 'found',
            emailSource: 'cache',
            emailDomain: domain,
            emailCheckedAt: now
          }
        }
      )

      console.log('  found from cache:', cachedEmail)
      continue
    }

    
  }

  console.log('\n MongoDb closed')
}

function makeWebsite(provider) {
  let website = provider.directWebsiteUrl || 
                provider.websiteUrl || 
                provider.website || 
                provider.websiteDomain || ''
  website = String(website).trim()

  if (website && !website.startsWith('http')) {
    website = 'https://' + website
  }

  return website.replace(/\/$/, '')
}

function makeDomain(website) {
  return website
    .replace('https://', '')
    .replace('http://', '')
    .replace('www.', '')
    .split('/')[0]
    .split('?')[0]
}

//FIXBEE-197