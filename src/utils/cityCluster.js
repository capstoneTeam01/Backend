
const clusters = {
  vancouver: [
    "Vancouver",
    "Burnaby",
    "Richmond",
    "North Vancouver",
    "West Vancouver",
    "New Westminster",
  ],
  richmond: ["Richmond", "Vancouver", "Burnaby", "Delta", "New Westminster"],
  burnaby: ["Burnaby", "Vancouver", "New Westminster", "Richmond"],
  surrey: ["Surrey", "Delta", "Langley", "White Rock", "New Westminster"],
  langley: ["Langley", "Surrey", "Abbotsford", "Maple Ridge"],
  abbotsford: ["Abbotsford", "Langley", "Chilliwack", "Mission"],
  victoria: ["Victoria", "Saanich", "Esquimalt", "Oak Bay", "Langford"],
};

const getCities = (city = "Vancouver") => {
    const clean = String(city || "Vancouver").trim() || "Vancouver";
    return clusters[key(clean)] || [clean];
};
const key = (txt = "") =>
  String(txt)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");


const getKeys = (list = []) => {
  const arr = [];

  for (const item of list) {
    const val = key(item);
    if (val) arr.push(val);
  }

  return arr;
};    
export { key, getCities, getKeys };