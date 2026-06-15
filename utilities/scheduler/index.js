require('dotenv').config();

const { getDb, closeDb } = require('./db');
const { check } = require('./api');
const { score, need } = require('./score');
const { getLog, addLog, hasDone } = require('./log');

function today() {
  let d = new Date().getDay();

  if (d === 1) return ['google'];
  if (d === 2) return ['yelp'];
  if (d === 3) return ['foursquare'];
  if (d === 4) return ['apify'];
  if (d === 5) return ['google'];
  if (d === 6) return ['yelp'];

  return ['foursquare', 'apify'];
}

function getSources() {
  let srcArg = process.argv[2];
  let srcEnv = process.env.SCHED_SOURCE;

  // Local manual run example: node index.js yelp 10
  if (srcArg && srcArg !== 'auto') return [srcArg];

  // Render/AWS run example: SCHED_SOURCE=google npm start
  if (srcEnv && srcEnv !== 'auto') {
    let arr = srcEnv.split(',');
    let list = [];

    for (let i = 0; i < arr.length; i++) {
      let s = arr[i].trim();
      if (s) list.push(s);
    }

    return list;
  }

  // Default cron mode. It checks the day and picks the source.
  return today();
}

function getLimit() {
  let limArg = process.argv[3];
  let limEnv = process.env.SCHED_LIMIT;

  if (limArg) return Number(limArg);
  if (limEnv) return Number(limEnv);

  return 10;
}

function next(src) {
  if (src === 'google') return 'yelp';
  if (src === 'yelp') return 'foursquare';
  if (src === 'foursquare') return 'apify';
  if (src === 'apify') return 'google';
  return null;
}

function addSource(old, src) {
  if (!old) return src;
  if (old.includes(src)) return old;
  return old + ', ' + src;
}

function makeUpdate(item, src, data, status) {
  let set = {};
  let changed = [];

  set.lastVerifiedAt = new Date();
  set.lastVerifiedSource = src;
  set.verifyStatus = status;
  set.sourceWebsite = addSource(item.sourceWebsite, src);
  set.updatedAt = new Date();

  if (data.rating !== null && data.rating !== undefined) {
    if (item.rating !== data.rating) changed.push('rating');
    set.rating = data.rating;
  }

  if (data.reviewCount !== null && data.reviewCount !== undefined) {
    if (item.reviewCount !== data.reviewCount) changed.push('reviewCount');
    set.reviewCount = data.reviewCount;
  }

  if (!item.websiteUrl && data.website) {
    set.websiteUrl = data.website;
    changed.push('websiteUrl');
  }

  if (!item.phoneNumber && data.phone) {
    set.phoneNumber = data.phone;
    changed.push('phoneNumber');
  }

  if (!item.serviceLocation && data.address) {
    set.serviceLocation = data.address;
    changed.push('serviceLocation');
  }

  return {
    set: set,
    changed: changed
  };
}

async function getList(spCol, src) {
  return await spCol.find({
    isDeleted: false,
    providerType: 'plumber',
    $or: [
      { nextSourceToTry: src },
      { nextSourceToTry: { $exists: false } },
      { nextSourceToTry: null },
      { nextSourceToTry: '' }
    ]
  }).toArray();
}

async function runOne(spCol, logCol, log, src, lim) {
  let all = await getList(spCol, src);
  let count = 0;

  for (let i = 0; i < all.length; i++) {
    let item = all[i];

    if (hasDone(log, item._id, src)) continue;
    if (count >= lim) break;

    console.log('Checking:', item.businessName, '-', src);

    let data = await check(item, src);
    let status = 'not_found';
    let points = 0;
    let changed = [];
    let nextSrc = next(src);

    if (data) {
      points = score(item, data);

      if (points >= need(src)) {
        status = 'verified';
        let obj = makeUpdate(item, src, data, status);
        changed = obj.changed;

        if (changed.length > 0) status = 'updated';

        await spCol.updateOne(
          { _id: item._id },
          { $set: obj.set, $unset: { nextSourceToTry: '' } }
        );

        nextSrc = null;
      } else {
        status = 'low_confidence';
        await spCol.updateOne(
          { _id: item._id },
          { $set: { verifyStatus: status, nextSourceToTry: nextSrc, updatedAt: new Date() } }
        );
      }

      console.log('Found:', data.businessName, '| score:', points, '| status:', status);
    } else {
      await spCol.updateOne(
        { _id: item._id },
        { $set: { verifyStatus: status, nextSourceToTry: nextSrc, updatedAt: new Date() } }
      );

      console.log('Found: none | status:', status);
    }

    await addLog(logCol, item, src, status, points, changed, nextSrc);

    count = count + 1;
  }

  console.log('Done source:', src, 'checked:', count);
}

async function run() {
  console.log('FixBee scheduler started');
  console.log('This job runs once and exits. No loop is used.');

  let db = await getDb();
  let spCol = db.collection(process.env.COL_SP);
  let logCol = db.collection(process.env.COL_LOG);

  let sources = getSources();
  let lim = getLimit();
  let log = await getLog(logCol);

  console.log('Sources:', sources.join(', '));
  console.log('Limit per source:', lim);

  for (let i = 0; i < sources.length; i++) {
    await runOne(spCol, logCol, log, sources[i], lim);
  }

  await logCol.updateOne(
    { _id: log._id },
    { $set: { status: 'completed', updatedAt: new Date() } }
  );

  await closeDb();

  console.log('FixBee scheduler finished');
}

run();
