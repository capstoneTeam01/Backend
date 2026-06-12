export async function getText(item) {
  const site = getSite(item);

  if (!site) {
    return { status: "no_website", urls: [], text: "" };
  }


  return { status: "testing"};
}

function getSite(item) {
  const arr = [
    item.websiteUrl,
    item.website,
    item.websiteDomain,
    item.businessWebsite,
    item.sourceUrl
  ];

  for (let i = 0; i < arr.length; i++) {
    const url = fixUrl(arr[i]);
    if (url && !isBadSite(url)) return url;
  }

  return "";
}


function fixUrl(url) {
  url = val(url);
  if (!url) return "";
  if (url.startsWith("mailto:")) return "";
  if (url.startsWith("tel:")) return "";
  if (!url.startsWith("http")) url = "https://" + url;
  return url;
}

function isBadSite(url) {
  const h = host(url);
  const bad = [
    "yelp.com",
    "facebook.com",
    "instagram.com",
    "google.com",
    "foursquare.com",
    "wheree.com",
    "bbb.org",
    "yellowpages.ca",
    "homestars.com"
  ];

  for (let i = 0; i < bad.length; i++) {
    if (h.includes(bad[i])) return true;
  }

  return false;
}

function val(x) {
  if (!x) return "";
  return String(x).trim();
}

function host(url) {
  try {
    return new URL(url).hostname.replace("www.", "").toLowerCase();
  } catch {
    return "";
  }
}

export async function askGroq(item, text) {
    const prompt = `Write a business description using only this website text.
    Business name: ${item.businessName || ""}
    City: ${item.city || ""}
    
    Rules:
    - Do not invent facts.
    - Use only the text given.
    - Return JSON only.
    
    JSON format:
    {
      "short": "1 short description",
      "long": "3 to 5 sentence description",
      "confidence": 0.8
    }
    
    Website text:
    ${text}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.GROQ_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 400,
          response_format: { type: "json_object" }
        })
    });

    
}