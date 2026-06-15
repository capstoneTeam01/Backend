const { getWeek } = require('./week');

function hasDone(log, id, src) {
  if (!log) return false;
  if (!log.providers) return false;

  let sid = String(id);

  for (let i = 0; i < log.providers.length; i++) {
    let item = log.providers[i];

    if (String(item.providerId) !== sid) continue;
    if (item.source !== src) continue;
    if (item.status === 'verified') return true;
    if (item.status === 'updated') return true;
  }

  return false;
}

async function getLog(col) {
  let w = getWeek();
  let log = await col.findOne({ weekKey: w.key });

  if (!log) {
    await col.insertOne({
      weekKey: w.key,
      label: w.label,
      year: w.year,
      month: w.month,
      week: w.week,
      weekStartDate: w.start,
      weekEndDate: w.end,
      status: 'running',
      summary: {
        checked: 0,
        verified: 0,
        updated: 0,
        notFound: 0,
        lowConfidence: 0,
        failed: 0
      },
      providers: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    log = await col.findOne({ weekKey: w.key });
  }

  return log;
}

function incFor(status) {
  let obj = { 'summary.checked': 1 };

  if (status === 'verified') obj['summary.verified'] = 1;
  if (status === 'updated') obj['summary.updated'] = 1;
  if (status === 'not_found') obj['summary.notFound'] = 1;
  if (status === 'low_confidence') obj['summary.lowConfidence'] = 1;
  if (status === 'failed') obj['summary.failed'] = 1;

  return obj;
}

async function addLog(col, item, src, status, points, changed, nextSrc) {
  let w = getWeek();

  let rec = {
    providerId: String(item._id),
    businessName: item.businessName,
    city: item.city,
    providerType: item.providerType,
    source: src,
    status: status,
    score: points,
    changed: changed,
    nextSourceToTry: nextSrc,
    verifiedDate: new Date()
  };

  await col.updateOne(
    { weekKey: w.key },
    {
      $set: {
        updatedAt: new Date()
      },
      $inc: incFor(status),
      $push: {
        providers: rec
      }
    }
  );
}

module.exports = {
  getLog,
  addLog,
  hasDone
};
