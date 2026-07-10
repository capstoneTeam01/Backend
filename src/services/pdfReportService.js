import PDFDocument from "pdfkit";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const logoPath = path.join(
  __dirname,
  "../../assets/pdf-logo.svg"
);

const colors = {
  brown: "#4A2F0B",
  amber: "#FBB800",
  amberSoft: "#FFF4C2",
  text: "#202020",
  muted: "#666666",
  border: "#E2D8C4",
  panel: "#FFFDF7",
  white: "#FFFFFF",
};

const clean = (value) => {
  return String(value ?? "").trim();
};

const getDisplayValue = (value) => {
  return clean(value) || "N/A";
};

const loadLogoBuffer = async () => {
  try {
    const svgBuffer = await fs.readFile(
      logoPath
    );

    return await sharp(svgBuffer)
      .png()
      .toBuffer();
  } catch (error) {
    console.warn(
      "[FixBee][PDF] logo could not be loaded",
      error.message
    );

    return null;
  }
};

const prepareReportImageBuffer = async (
  imageBuffer
) => {
  if (!imageBuffer) {
    return null;
  }

  try {
    return await sharp(imageBuffer)
      .trim({
        background: "#000000",
        threshold: 18,
      })
      .png()
      .toBuffer();
  } catch (error) {
    console.warn(
      "[FixBee][PDF] image could not be optimized",
      error.message
    );

    return imageBuffer;
  }
};

const normalizeList = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      return "";
    })
    .filter(Boolean);
};

const ensurePageSpace = (
  document,
  requiredSpace = 70
) => {
  const pageBottom =
    document.page.height - 50;

  if (
    document.y + requiredSpace >
    pageBottom
  ) {
    document.addPage();
  }
};

const addSectionTitle = (
  document,
  title
) => {
  ensurePageSpace(document);
  document.x = 50;

  document
    .moveDown(0.7)
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(colors.brown)
    .text(title);

  document
    .moveTo(50, document.y + 4)
    .lineTo(
      document.page.width - 50,
      document.y + 4
    )
    .strokeColor(colors.amber)
    .stroke();

  document.moveDown(0.8);
};

const addField = (
  document,
  label,
  value
) => {
  ensurePageSpace(document, 35);
  document.x = 50;

  document
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(colors.brown)
    .text(`${label}: `, {
      continued: true,
    })
    .font("Helvetica")
    .fillColor(colors.text)
    .text(getDisplayValue(value));

  document.moveDown(0.35);
};

const addParagraph = (
  document,
  value,
  emptyMessage
) => {
  ensurePageSpace(document, 60);
  document.x = 50;

  document
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(colors.text)
    .text(
      clean(value) || emptyMessage,
      {
        lineGap: 3,
        paragraphGap: 6,
      }
    );
};

const addList = (
  document,
  items,
  emptyMessage
) => {
  const normalizedItems =
    normalizeList(items);

  if (!normalizedItems.length) {
    document
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(colors.muted)
      .text(emptyMessage);

    return;
  }

  normalizedItems.forEach((item) => {
    ensurePageSpace(document, 40);
    document.x = 50;

    document
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(colors.text)
      .text(`• ${item}`, {
        indent: 10,
        lineGap: 2,
        paragraphGap: 6,
      });
  });
};

const addHeader = (
  document,
  reportData,
  logoBuffer
) => {
  document
    .rect(
      0,
      0,
      document.page.width,
      96
    )
    .fill(colors.amberSoft);

  document
    .rect(
      0,
      0,
      document.page.width,
      8
    )
    .fill(colors.amber);

  if (logoBuffer) {
    document.image(
      logoBuffer,
      410,
      26,
      {
        width: 135,
      }
    );
  } else {
    document
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor(colors.brown)
      .text("FixBee", 440, 34, {
        width: 105,
        align: "right",
      });
  }

  document
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(colors.brown)
    .text(
      "Expert Technical Assessment",
      50,
      30,
      {
        width: 330,
      }
    );

  document
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(colors.muted)
    .text(
      `Report ID: ${getDisplayValue(
        reportData.photoId
      )}`,
      50,
      58,
      {
        width: 330,
      }
    );

  document.y = 122;
};

const addBadge = (
  document,
  label,
  value,
  x,
  y,
  width,
  fillColor = colors.panel
) => {
  const height = 54;

  document
    .roundedRect(
      x,
      y,
      width,
      height,
      8
    )
    .fillAndStroke(
      fillColor,
      colors.border
    );

  document
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(colors.muted)
    .text(
      label.toUpperCase(),
      x + 12,
      y + 10,
      {
        width: width - 24,
      }
    );

  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(colors.brown)
    .text(
      getDisplayValue(value),
      x + 12,
      y + 27,
      {
        width: width - 24,
        lineGap: 1,
      }
    );
};

const getRiskFillColor = (urgency) => {
  const normalizedUrgency =
    clean(urgency).toLowerCase();

  if (normalizedUrgency === "high") {
    return "#FFE5E5";
  }

  if (normalizedUrgency === "medium") {
    return colors.amberSoft;
  }

  if (normalizedUrgency === "low") {
    return "#EAF7EE";
  }

  return colors.panel;
};

const addSummaryGrid = (
  document,
  reportData
) => {
  ensurePageSpace(document, 145);

  const startX = 50;
  const gap = 10;
  const cardWidth =
    (document.page.width - 100 - gap) / 2;
  let y = document.y;

  addBadge(
    document,
    "Detected Issue",
    reportData.detectedIssue,
    startX,
    y,
    cardWidth
  );

  addBadge(
    document,
    "Risk Level",
    reportData.urgency,
    startX + cardWidth + gap,
    y,
    cardWidth,
    getRiskFillColor(reportData.urgency)
  );

  y += 66;

  addBadge(
    document,
    "Affected Component",
    reportData.detectedObject,
    startX,
    y,
    cardWidth
  );

  addBadge(
    document,
    "Estimated Cost",
    reportData.estimatedCostRange,
    startX + cardWidth + gap,
    y,
    cardWidth
  );

  y += 66;

  addBadge(
    document,
    "Repair Category",
    reportData.category,
    startX,
    y,
    cardWidth
  );

  addBadge(
    document,
    "Estimated Time",
    reportData.estimatedRepairTime,
    startX + cardWidth + gap,
    y,
    cardWidth
  );

  document.y = y + 70;
  document.x = 50;
};

const addImageBlock = (
  document,
  imageBuffer,
  imageHeight
) => {
  if (!imageBuffer) {
    return;
  }

  ensurePageSpace(
    document,
    imageHeight + 30
  );

  const imageTop = document.y;
  const imageX = 50;
  const imageWidth =
    document.page.width - 100;

  document
    .roundedRect(
      imageX,
      imageTop,
      imageWidth,
      imageHeight,
      8
    )
    .fillAndStroke(
      colors.white,
      colors.border
    );

  try {
    document.image(
      imageBuffer,
      imageX + 10,
      imageTop + 10,
      {
        fit: [
          imageWidth - 20,
          imageHeight - 20,
        ],
        align: "center",
        valign: "center",
      }
    );

    document.y =
      imageTop + imageHeight + 18;
    document.x = 50;
  } catch (error) {
    console.warn(
      "[FixBee][PDF] image could not be inserted",
      error.message
    );
  }
};

const getImageBlockHeight = async (
  imageBuffer
) => {
  if (!imageBuffer) {
    return 215;
  }

  try {
    const metadata =
      await sharp(imageBuffer).metadata();

    if (
      !metadata.width ||
      !metadata.height
    ) {
      return 215;
    }

    const imageWidth = 475;
    const innerWidth =
      imageWidth - 20;
    const imageRatio =
      metadata.width / metadata.height;
    const naturalHeight =
      Math.round(innerWidth / imageRatio) + 20;

    return Math.min(
      Math.max(naturalHeight, 190),
      285
    );
  } catch (error) {
    console.warn(
      "[FixBee][PDF] image size could not be checked",
      error.message
    );

    return 215;
  }
};

const addFooter = (document) => {
  ensurePageSpace(document, 65);

  document
    .moveDown()
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(colors.muted)
    .text(
      "This report provides a preliminary technical assessment for quotation purposes. It is not a final diagnosis, inspection certificate, repair authorization, or confirmation of code compliance. A qualified service professional must verify the condition and repair requirements on site.",
      {
        align: "center",
        lineGap: 2,
      }
    );
};

const downloadImage = async (
  imageUrl
) => {
  const url = clean(imageUrl);

  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        "[FixBee][PDF] image download failed",
        response.status
      );

      return null;
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    const isSupportedImage =
      contentType.includes(
        "image/jpeg"
      ) ||
      contentType.includes(
        "image/png"
      );

    if (!isSupportedImage) {
      console.warn(
        "[FixBee][PDF] unsupported image type",
        contentType
      );

      return null;
    }

    const arrayBuffer =
      await response.arrayBuffer();

    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn(
      "[FixBee][PDF] image could not be loaded",
      error.message
    );

    return null;
  }
};

const generateIssueReportPdf = async (
  reportData = {}
) => {
  const originalImageBuffer =
    await downloadImage(
      reportData.imageUrl
    );

  const imageBuffer =
    await prepareReportImageBuffer(
      originalImageBuffer
    );

  const logoBuffer =
    await loadLogoBuffer();

  const imageHeight =
    await getImageBlockHeight(imageBuffer);

  const technicalReport =
    reportData.technicalReport || {};

  return new Promise(
    (resolve, reject) => {
      const document =
        new PDFDocument({
          size: "A4",
          margin: 50,

          info: {
            Title:
              "FixBee Expert Technical Assessment",

            Author: "FixBee",
          },
        });

      const chunks = [];

      document.on(
        "data",
        (chunk) => {
          chunks.push(chunk);
        }
      );

      document.on("end", () => {
        resolve(
          Buffer.concat(chunks)
        );
      });

      document.on(
        "error",
        reject
      );

      addHeader(
        document,
        reportData,
        logoBuffer
      );

      addImageBlock(
        document,
        imageBuffer,
        imageHeight
      );

      addSectionTitle(
        document,
        "Executive Summary"
      );

      addParagraph(
        document,
        technicalReport.executiveSummary,
        "No technical summary was generated."
      );

      addSectionTitle(
        document,
        "Visible Observations"
      );

      addList(
        document,
        technicalReport.visibleObservations,
        "No confirmed visual observations were available."
      );

      addSectionTitle(
        document,
        "Technical Assessment"
      );

      addParagraph(
        document,
        technicalReport.technicalAssessment,
        "The condition requires an on-site assessment before a final diagnosis can be made."
      );

      addSectionTitle(
        document,
        "Possible Causes"
      );

      addList(
        document,
        technicalReport.possibleCauses,
        "Possible underlying causes could not be determined from the submitted image."
      );

      addSectionTitle(
        document,
        "Recommended On-Site Diagnostic Checks"
      );

      addList(
        document,
        technicalReport.recommendedDiagnosticChecks,
        "A qualified technician should inspect the affected component and surrounding connections."
      );

      addSectionTitle(
        document,
        "Likely Repair Scope"
      );

      addList(
        document,
        technicalReport.likelyRepairScope,
        "The final repair scope must be determined during the on-site inspection."
      );

      addSectionTitle(
        document,
        "Case Overview"
      );

      addSummaryGrid(
        document,
        reportData
      );

      addField(
        document,
        "Confidence basis",
        reportData.confidenceReason
      );

      addSectionTitle(
        document,
        "Assessment Limitations"
      );

      addParagraph(
        document,
        technicalReport.limitations,
        "This report is based on the submitted image and available FixBee analysis. Hidden damage and the final root cause cannot be confirmed without an on-site inspection."
      );

      addFooter(document);

      document.end();
    }
  );
};

export {
  generateIssueReportPdf,
};
