import nodemailer from "nodemailer";

import {
  PhotoAnalysis,
} from "../internal/db/photoAnalysis.js";
import {
  RecentScanModel,
} from "../internal/db/recentScan.js";
import {
  generateIssueReportPdf,
} from "./pdfReportService.js";
import {
  generateExpertTechnicalReport,
} from "./expertTechnicalReportService.js";

const clean = (value) => {
  return String(value || "").trim();
};

const uniqueEmails = (values = []) => {
  const seen = new Set();

  return values
    .map((value) => {
      return clean(value).toLowerCase();
    })
    .filter((email) => {
      if (
        !email ||
        !email.includes("@") ||
        seen.has(email)
      ) {
        return false;
      }

      seen.add(email);
      return true;
    });
};

const normalizeProviders = (
  providers = []
) => {
  if (!Array.isArray(providers)) {
    return [];
  }

  return providers.map((provider) => {
    return {
      id: clean(provider.id),
      mongoId: clean(provider.mongoId),
      providerId: clean(provider.providerId),

      businessName: clean(
        provider.businessName
      ),

      email: clean(
        provider.email
      ).toLowerCase(),

      phoneDisplay: clean(
        provider.phoneDisplay
      ),

      address: clean(provider.address),
      city: clean(provider.city),
      rating: provider.rating ?? null,
      reviewCount:
        provider.reviewCount ?? null,
    };
  });
};

const getTransport = () => {
  const user = clean(
    process.env.FIXBEE_MAIL_USER
  );

  const pass = clean(
    process.env.FIXBEE_MAIL_APP_PASSWORD
  );

  if (!user || !pass) {
    throw new Error(
      "Missing FIXBEE_MAIL_USER or FIXBEE_MAIL_APP_PASSWORD in backend .env"
    );
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,

    auth: {
      user,
      pass,
    },
  });
};

const downloadPdfBuffer = async (pdfUrl) => {
  const url = clean(pdfUrl);

  if (!url) {
    return null;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Cached PDF download failed with status ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
};

const getCachedPdfAttachment = async (photo) => {
  if (
    photo?.expertReportStatus !== "completed" ||
    !photo?.expertReportUrl
  ) {
    return null;
  }

  try {
    const pdfBuffer =
      await downloadPdfBuffer(photo.expertReportUrl);

    if (!pdfBuffer) {
      return null;
    }

    return {
      pdfBuffer,
      pdfFilename:
        photo.expertReportFilename ||
        `FixBee-Issue-Report-${photo._id}.pdf`,
      source: "cached",
    };
  } catch (error) {
    console.warn(
      "[FixBee][QuoteEmail] cached PDF unavailable:",
      error.message
    );

    return null;
  }
};

const generatePdfAttachment = async (
  reportData,
  { useLocalLlm = false } = {}
) => {
  const technicalReport =
    await generateExpertTechnicalReport(
      reportData,
      { useLocalLlm }
    );

  const pdfBuffer =
    await generateIssueReportPdf({
      ...reportData,
      technicalReport,
    });

  return {
    pdfBuffer,
    pdfFilename:
      `FixBee-Issue-Report-${reportData.photoId}.pdf`,
    source: "generated",
  };
};

const buildHtmlFromText = ({
  text,
  imageUrl,
}) => {
  const safeText = clean(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map((line) => {
      return line || "&nbsp;";
    })
    .join("<br/>");

  const imageBlock = imageUrl
    ? `<p><img src="${imageUrl}" alt="Issue photo" style="max-width:240px;border-radius:12px;border:1px solid #eee"/></p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#202020">
      ${safeText}
      ${imageBlock}
    </div>
  `;
};

const getReportData = async ({
  user,
  payload,
  requesterEmail,
}) => {
  const photoId = clean(payload.photoId);

  if (!photoId) {
    throw new Error(
      "photoId is required to generate the issue report."
    );
  }

  if (!/^[a-fA-F0-9]{24}$/.test(photoId)) {
    throw new Error(
      "Invalid photoId."
    );
  }

  const photo =
    await PhotoAnalysis.getByIdForUser(
      photoId,
      user._id
    );

  if (!photo) {
    throw new Error(
      "Analyzed photo was not found."
    );
  }

  let analysis;

  try {
    analysis = JSON.parse(
      photo.aiResponse || ""
    );
  } catch (error) {
    throw new Error(
      "The selected photo does not contain a valid analysis."
    );
  }

  return {
    photo,
    photoId: photo._id.toString(),

    imageUrl:
      analysis.imageUrl ||
      photo.imageUrl ||
      payload.email?.imageUrl ||
      payload.images?.[0]?.url,

    detectedIssue:
      analysis.detectedIssue ||
      payload.issue?.title,

    detectedObject:
      analysis.detectedObject ||
      photo.detectedObject,

    category:
      analysis.category ||
      payload.issue?.category ||
      "Plumbing",

    urgency: analysis.urgency,
    confidence: analysis.confidence,

    confidenceReason:
      analysis.confidenceReason,

    visualEvidence:
      analysis.visualEvidence || {},

    issuesToFix:
      analysis.issuesToFix || [],

    recommendedActions:
      analysis.recommendedActions || [],

    estimatedCostRange:
      analysis.estimatedCostRange,

    estimatedRepairTime:
      analysis.estimatedRepairTime,

    providerType:
      analysis.providerType,

    requester: {
      ...(payload.requester || {}),

      email:
        clean(payload.requester?.email) ||
        requesterEmail,
    },

    serviceRequest:
      payload.serviceRequest || {},
  };
};

const saveRecentScan = async ({
  user,
  payload,
  providers,
  mailResult,
  status,
}) => {
  const selectedProviderIds = providers
    .map((provider) => {
      return (
        provider.id ||
        provider.mongoId ||
        provider.providerId
      );
    })
    .filter(Boolean);

  const selectedProviderEmails =
    uniqueEmails(
      providers.map((provider) => {
        return provider.email;
      })
    );

  const saved =
    await RecentScanModel.create({
      userID: user._id,

      userEmail: clean(
        user.email
      ).toLowerCase(),

      scanType:
        clean(payload.scanType) ||
        "service-provider-quote-request",

      status,

      providers,
      selectedProviderIds,
      selectedProviderEmails,

      requester: {
        ...(payload.requester || {}),

        email:
          clean(payload.requester?.email) ||
          clean(user.email),
      },

      issue: payload.issue || {},

      serviceRequest:
        payload.serviceRequest || {},

      email: payload.email || {},

      images: Array.isArray(
        payload.images
      )
        ? payload.images
        : [],

      mailResult,
      rawPayload: payload,
    });

  console.log(
    "[FixBee][RecentScans] provider quote request saved",
    {
      recentScanId: saved._id,
      userID: user._id,
      providerCount: providers.length,
      status,
    }
  );

  return saved;
};

const sendProviderQuoteRequest = async ({
  user,
  payload,
}) => {
  const providers =
    normalizeProviders(payload.providers);

  const providerEmails =
    uniqueEmails(
      providers.map((provider) => {
        return provider.email;
      })
    );

  if (!providers.length) {
    throw new Error(
      "At least one selected service provider is required."
    );
  }

  if (!providerEmails.length) {
    throw new Error(
      "At least one selected provider must have an email address."
    );
  }

  const [to, ...bccList] =
    providerEmails;

  const requesterEmail =
    clean(payload.requester?.email) ||
    clean(user.email);

  const imageUrl =
    clean(payload.email?.imageUrl) ||
    clean(payload.images?.[0]?.url);

  const subject =
    clean(payload.email?.subject) ||
    "FixBee service quote request";

  const text =
    clean(payload.email?.body) ||
    "A FixBee user is requesting a service quote.";

  const html =
    clean(payload.email?.htmlBody) ||
    buildHtmlFromText({
      text,
      imageUrl,
    });

  const fromUser = clean(
    process.env.FIXBEE_MAIL_USER
  );

  const fromName =
    clean(
      process.env.FIXBEE_MAIL_FROM_NAME
    ) || "FixBee";

  const reportData =
    await getReportData({
      user,
      payload,
      requesterEmail,
    });

  const cachedPdfAttachment =
    await getCachedPdfAttachment(
      reportData.photo
    );

  const pdfAttachment =
    cachedPdfAttachment ||
    await generatePdfAttachment(
      reportData,
      {
        useLocalLlm:
          user?.aiSettings?.useLocalLlm === true,
      }
    );

  console.log(
    "[FixBee][QuoteEmail] sending official quote email",
    {
      to,
      cc: requesterEmail,
      bccCount: bccList.length,
      providerCount: providers.length,
      pdfAttached: true,
      pdfSource: pdfAttachment.source,
    }
  );

  const transport = getTransport();

  const mailResult =
    await transport.sendMail({
      from: `"${fromName}" <${fromUser}>`,

      to,

      cc:
        requesterEmail || undefined,

      bcc: bccList.length
        ? bccList.join(",")
        : undefined,

      subject,
      text,
      html,

      attachments: [
        {
          filename: pdfAttachment.pdfFilename,
          content: pdfAttachment.pdfBuffer,
          contentType:
            "application/pdf",
        },
      ],
    });

  const recentScan =
    await saveRecentScan({
      user,
      payload,
      providers,

      mailResult: {
        messageId:
          mailResult.messageId,

        accepted:
          mailResult.accepted,

        rejected:
          mailResult.rejected,

        response:
          mailResult.response,

        pdfFilename:
          pdfAttachment.pdfFilename,
        pdfSource:
          pdfAttachment.source,
      },

      status:
        "official-email-sent",
    });

  return {
    mailResult,
    recentScan,
    to,
    cc: requesterEmail,
    bcc: bccList,
  };
};

export {
  sendProviderQuoteRequest,
};
