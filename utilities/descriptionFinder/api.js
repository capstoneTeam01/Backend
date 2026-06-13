export async function getText(item) {
  const site = getSite(item);

  if (!site) {
    return { status: "no_website", urls: [], text: "" };
  }

  const html = await page(site);
  const urls = [site];
  const more = links(html, site);
  let text = plain(html);

  for (let i = 0; i < more.length; i++) {
    const html2 = await page(more[i]);
    urls.push(more[i]);
    text = text + " " + plain(html2);
  }

  text = text.slice(0, 5000);

  if (text.length < 200) {
    return { status: "not_enough_text", urls, text };
  }

  return { status: "text_found", urls, text };
}


async function page(url) {
  const res = await fetch(url);
  const html = await res.text();
  return html;
}

function links(html, base) {
  const list = [];
  const baseHost = host(base);
  const re = /href=["']([^"']+)["']/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    let url = m[1];

    try {
      url = new URL(url, base).toString();
    } catch {
      url = "";
    }

    const low = url.toLowerCase();
    const good = low.includes("about") || low.includes("service") || low.includes("contact");

    if (url && host(url) === baseHost && good && !list.includes(url)) {
      list.push(url);
    }
  }

  return list.slice(0, 3);
}


function plain(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
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

  const data = await res.json();
  const out = data.choices[0].message.content;
  const obj = JSON.parse(out);

  return {
    short: obj.short || "",
    long: obj.long || "",
    confidence: Number(obj.confidence || 0.7)
  };    

}