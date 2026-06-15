function clean(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function phone(s) {
  if (!s) return '';
  return String(s).replace(/[^0-9]/g, '');
}

function domain(s) {
  if (!s) return '';
  let txt = String(s).toLowerCase();
  txt = txt.replace('https://', '').replace('http://', '').replace('www.', '');
  return txt.split('/')[0];
}

function words(s) {
  if (!s) return [];

  let bad = ['and', 'the', 'ltd', 'inc', 'co', 'company', 'heating', 'plumbing', 'plumber', 'services', 'service'];
  let txt = String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  let arr = txt.split(' ');
  let list = [];

  for (let i = 0; i < arr.length; i++) {
    let w = arr[i].trim();
    if (w.length < 3) continue;
    if (bad.includes(w)) continue;
    list.push(w);
  }

  return list;
}

function namePoints(a, b) {
  let n1 = clean(a);
  let n2 = clean(b);

  if (n1 && n2 && (n1.includes(n2) || n2.includes(n1))) return 20;

  let aWords = words(a);
  let bWords = words(b);
  let count = 0;

  for (let i = 0; i < aWords.length; i++) {
    if (bWords.includes(aWords[i])) count = count + 1;
  }

  if (count >= 2) return 15;
  if (count === 1) return 10;

  return 0;
}

function score(a, b) {
  let points = 0;

  let p1 = phone(a.phoneNumber);
  let p2 = phone(b.phone);
  if (p1 && p2 && (p1 === p2 || p1.endsWith(p2) || p2.endsWith(p1))) points = points + 40;

  let w1 = domain(a.websiteUrl);
  let w2 = domain(b.website);
  if (w1 && w2 && w1 === w2) points = points + 30;

  points = points + namePoints(a.businessName, b.businessName);

  let c1 = clean(a.city);
  let c2 = clean(b.city);
  if (c1 && c2 && c1 === c2) points = points + 10;

  let t1 = clean(a.providerType);
  let t2 = clean((b.categories || []).join(' '));
  if (t1 && t2 && t2.includes(t1)) points = points + 5;

  return points;
}

function need(src) {

  if (src === 'yelp') return 60;
  if (src === 'foursquare') return 60;

  return 80;
}

module.exports = { score, need };
