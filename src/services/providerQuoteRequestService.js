import nodemailer from "nodemailer";

import { RecentScanModel } from "../internal/db/recentScan.js";

const clean = (value) => String(value || "").trim();

const uniqueEmails = (values = []) => {
  const seen = new Set();

  return values
    .map((value) => clean(value).toLowerCase())
    .filter((email) => {
      if (!email || !email.includes("@") || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
};

const normalizeProviders = (providers = []) => {
  if (!Array.isArray(providers)) return [];

  return providers.map((provider) => ({
    id: clean(provider.id),
    mongoId: clean(provider.mongoId),
    providerId: clean(provider.providerId),
    businessName: clean(provider.businessName),
    email: clean(provider.email).toLowerCase(),
    phoneDisplay: clean(provider.phoneDisplay),
    address: clean(provider.address),
    city: clean(provider.city),
    rating: provider.rating ?? null,
    reviewCount: provider.reviewCount ?? null,
  }));
};

const getTransport = () => {
  const user = clean(process.env.FIXBEE_MAIL_USER);
  const pass = clean(process.env.FIXBEE_MAIL_APP_PASSWORD);

  if (!user || !pass) {
    throw new Error("Missing FIXBEE_MAIL_USER or FIXBEE_MAIL_APP_PASSWORD in backend .env");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
};

const buildHtmlFromText = ({ text, imageUrl }) => {
  const safeText = clean(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map((line) => line || "&nbsp;")
    .join("<br/>");

  const imageBlock = imageUrl
    ? `<p><img src="${imageUrl}" alt="Issue photo" style="max-width:240px;border-radius:12px;border:1px solid #eee"/></p>`
    : "";

  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#202020">${safeText}${imageBlock}</div>`;
};

const saveRecentScan = async ({ user, payload, providers, mailResult, status }) => {
  const selectedProviderIds = providers
    .map((provider) => provider.id || provider.mongoId || provider.providerId)
    .filter(Boolean);
  const selectedProviderEmails = uniqueEmails(providers.map((provider) => provider.email));

  const saved = await RecentScanModel.create({
    userID: user._id,
    userEmail: clean(user.email).toLowerCase(),
    scanType: clean(payload.scanType) || "service-provider-quote-request",
    status,
    providers,
    selectedProviderIds,
    selectedProviderEmails,
    requester: {
      ...(payload.requester || {}),
      email: clean(payload.requester?.email) || clean(user.email),
    },
    issue: payload.issue || {},
    serviceRequest: payload.serviceRequest || {},
    email: payload.email || {},
    images: Array.isArray(payload.images) ? payload.images : [],
    mailResult,
    rawPayload: payload,
  });

  console.log("[FixBee][RecentScans] provider quote request saved", {
    recentScanId: saved._id,
    userID: user._id,
    providerCount: providers.length,
    status,
  });

  return saved;
};

const sendProviderQuoteRequest = async ({ user, payload }) => {
  const providers = normalizeProviders(payload.providers);
  const providerEmails = uniqueEmails(providers.map((provider) => provider.email));

  if (!providers.length) {
    throw new Error("At least one selected service provider is required.");
  }

  if (!providerEmails.length) {
    throw new Error("At least one selected provider must have an email address.");
  }

  const [to, ...bccList] = providerEmails;
  const requesterEmail = clean(payload.requester?.email) || clean(user.email);
  const imageUrl = clean(payload.email?.imageUrl) || clean(payload.images?.[0]?.url);
  const subject = clean(payload.email?.subject) || "FixBee service quote request";
  const text = clean(payload.email?.body) || "A FixBee user is requesting a service quote.";
  const html = clean(payload.email?.htmlBody) || buildHtmlFromText({ text, imageUrl });
  const fromUser = clean(process.env.FIXBEE_MAIL_USER);
  const fromName = clean(process.env.FIXBEE_MAIL_FROM_NAME) || "FixBee";

  console.log("[FixBee][QuoteEmail] sending official quote email", {
    to,
    cc: requesterEmail,
    bccCount: bccList.length,
    providerCount: providers.length,
  });

  const transport = getTransport();
  const mailResult = await transport.sendMail({
    from: `"${fromName}" <${fromUser}>`,
    to,
    cc: requesterEmail || undefined,
    bcc: bccList.length ? bccList.join(",") : undefined,
    subject,
    text,
    html,
  });

  const recentScan = await saveRecentScan({
    user,
    payload,
    providers,
    mailResult: {
      messageId: mailResult.messageId,
      accepted: mailResult.accepted,
      rejected: mailResult.rejected,
      response: mailResult.response,
    },
    status: "official-email-sent",
  });

  return {
    mailResult,
    recentScan,
    to,
    cc: requesterEmail,
    bcc: bccList,
  };
};

export { sendProviderQuoteRequest };
