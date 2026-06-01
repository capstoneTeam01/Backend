const { MongoClient } = require('mongodb')
require('dotenv').config()

main()

async function main() {
  const limit = Number(process.argv[2] || 10) 
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()  
     
  const database = client.db(process.env.DB_NAME)
  const providersCol = database.collection(process.env.COL_NAME)
  const cacheCol = database.collection(process.env.COL_CACHE)

  const providers = await providersCol.find({
    isDeleted: { $ne: true }
  }).limit(limit).toArray()

  console.log('providers:', providers.length)    

  for (const provider of providers) {
    const website = makeWebsite(provider)
    const domain = makeDomain(website)
    const now = new Date()
    console.log('\nchecking:', provider.businessName)



    const oldEmail = provider.email || provider.businessEmail
    if (oldEmail) {
      console.log('  already has email:', oldEmail)
      continue
    }

    if (!website) {
      console.log('  no website')

      await providersCol.updateOne(
        { _id: provider._id },
        {
          $set: {
            emailStatus: 'no_website',
            emailCheckedAt: now
          }
        }
      )

      continue
    }
    
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


    const emails = await getEmailsFromWebsite(website)
    const bestEmail = pickEmail(emails, domain)

    if (bestEmail) {
      await providersCol.updateOne(
        { _id: provider._id },
        {
          $set: {
            email: bestEmail,
            businessEmail: bestEmail,
            emailStatus: 'found',
            emailSource: 'website',
            emailDomain: domain,
            emailCheckedAt: now
          }
        }
      )

      await cacheCol.updateOne(
        { domain: domain },
        {
          $set: {
            domain: domain,
            email: bestEmail,
            source: 'website',
            checkedAt: now,
            businessName: provider.businessName
          }
        },
        { upsert: true }
      )
      
    } else {
      await providersCol.updateOne(
        { _id: provider._id },
        {
          $set: {
            emailStatus: 'not_found',
            emailDomain: domain,
            emailCheckedAt: now
          }
        }
      )

      console.log('  not found')
    }
    
  }

    await client.close() 
    console.log('\n MongoDb closed')
}
  


//FIXBEE-197
function makeWebsite(provider) {
  let website = provider.directWebsiteUrl || 
                provider.websiteUrl || 
                provider.website || 
                provider.websiteDomain || ''
  website = String(website).trim()

  if (!website) {
    return ''
  }
  
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


async function getEmailsFromWebsite(website) {
  const pages = [
    website,
    website + '/contact',
    website + '/contact-us',
    website + '/about'
  ]

  let emails = []

  for (const pageUrl of pages) {
    console.log('  page:', pageUrl)
    const html = await readPage(pageUrl)
    const pageEmails = findEmails(html)

    for (const email of pageEmails) {
      if (!emails.includes(email)) {
        emails.push(email)
      }
    }
  }

  return emails
}

async function readPage(pageUrl) {
  console.log('  page:', pageUrl)

  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'FixBee student project'
      }
    })

    const text = await response.text()
    return text
  } catch (error) {
    console.log('  page skipped')
    return ''
  }
}
//https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression
function findEmails(text) {
  const found = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const emails = []

  for (const item of found) {
    const email = item.toLowerCase()

    if (email.includes('.png')) continue
    if (email.includes('.jpg')) continue
    if (email.includes('.jpeg')) continue
    if (email.includes('.gif')) continue
    if (email.includes('example.com')) continue
    if (email.includes('domain.com')) continue
    if (email.includes('noreply')) continue
    if (email.includes('no-reply')) continue

    if (!emails.includes(email)) {
      emails.push(email)
    }
  }

  return emails
}

function pickEmail(emails, domain) {
  for (const email of emails) {
    if (email.endsWith('@' + domain)) {
      return email
    }
  }

  return emails[0] || ''
}


//FIXBEE-197