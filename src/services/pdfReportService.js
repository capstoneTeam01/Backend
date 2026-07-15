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

const rubikRegularPath = path.join(
  __dirname,
  "../../assets/fonts/Rubik-Regular.ttf"
);

const rubikBoldPath = path.join(
  __dirname,
  "../../assets/fonts/Rubik-Bold.ttf"
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

const typography = {
  title: 20,
  sectionTitle: 16,
  h3: 14,
  cardTitle: 12,
  body: 10.5,
  caption: 9.5,
  smallCaption: 8.5,
};

const clean = (value) => {
  return String(value ?? "").trim();
};

const getDisplayValue = (value) => {
  return clean(value) || "N/A";
};

const toTitleCase = (value) => {
  const text = clean(value);

  if (!text) {
    return "N/A";
  }

  return text
    .split(" ")
    .map((word) => {
      if (!word) {
        return "";
      }

      if (
        /^[A-Z0-9/$–-]+$/.test(word)
      ) {
        return word;
      }

      const lowerCaseWord =
        word.toLowerCase();

      return (
        lowerCaseWord.charAt(0).toUpperCase() +
        lowerCaseWord.slice(1)
      );
    })
    .join(" ");
};

const capitalizeFirstLetter = (value) => {
  const text = clean(value);

  if (!text) {
    return "";
  }

  return text.replace(
    /[A-Za-z]/,
    (letter) => {
      return letter.toUpperCase();
    }
  );
};

const getPdfFonts = async () => {
  try {
    await fs.access(rubikRegularPath);

    try {
      await fs.access(rubikBoldPath);

      return {
        regular: "Rubik",
        bold: "RubikBold",
        regularPath: rubikRegularPath,
        boldPath: rubikBoldPath,
      };
    } catch {
      return {
        regular: "Rubik",
        bold: "Rubik",
        regularPath: rubikRegularPath,
        boldPath: rubikRegularPath,
      };
    }
  } catch {
    return {
      regular: "Helvetica",
      bold: "Helvetica-Bold",
      regularPath: null,
      boldPath: null,
    };
  }
};

const registerPdfFonts = (
  document,
  fonts
) => {
  if (fonts.regularPath) {
    document.registerFont(
      fonts.regular,
      fonts.regularPath
    );
  }

  if (
    fonts.boldPath &&
    fonts.boldPath !== fonts.regularPath
  ) {
    document.registerFont(
      fonts.bold,
      fonts.boldPath
    );
  }
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
  title,
  fonts
) => {
  ensurePageSpace(document);
  document.x = 50;

  document
    .moveDown(0.7)
    .font(fonts.regular)
    .fontSize(typography.sectionTitle)
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
  value,
  fonts
) => {
  ensurePageSpace(document, 35);
  document.x = 50;

  document
    .font(fonts.regular)
    .fontSize(typography.body)
    .fillColor(colors.brown)
    .text(`${label}: `, {
      continued: true,
    })
    .font(fonts.regular)
    .fillColor(colors.text)
    .text(
      capitalizeFirstLetter(
        getDisplayValue(value)
      )
    );

  document.moveDown(0.35);
};

const addParagraph = (
  document,
  value,
  emptyMessage,
  fonts
) => {
  ensurePageSpace(document, 60);
  document.x = 50;

  document
    .font(fonts.regular)
    .fontSize(typography.body)
    .fillColor(colors.text)
    .text(
      capitalizeFirstLetter(
        clean(value) || emptyMessage
      ),
      {
        lineGap: 3,
        paragraphGap: 6,
      }
    );
};

const addList = (
  document,
  items,
  emptyMessage,
  fonts
) => {
  const normalizedItems =
    normalizeList(items);

  if (!normalizedItems.length) {
    document
      .font(fonts.regular)
      .fontSize(typography.body)
      .fillColor(colors.muted)
      .text(
        capitalizeFirstLetter(
          emptyMessage
        )
      );

    return;
  }

  normalizedItems.forEach((item) => {
    ensurePageSpace(document, 40);
    document.x = 50;

    document
      .font(fonts.regular)
      .fontSize(typography.body)
      .fillColor(colors.text)
      .text(`• ${capitalizeFirstLetter(item)}`, {
        indent: 10,
        lineGap: 2,
        paragraphGap: 6,
      });
  });
};

const addHeader = (
  document,
  reportData,
  logoBuffer,
  fonts
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
      .font(fonts.regular)
      .fontSize(typography.title)
      .fillColor(colors.brown)
      .text("FixBee", 440, 34, {
        width: 105,
        align: "right",
      });
  }

  document
    .font(fonts.regular)
    .fontSize(typography.title)
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
    .font(fonts.regular)
    .fontSize(typography.caption)
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
  fonts,
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
    .font(fonts.regular)
    .fontSize(typography.smallCaption)
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
    .font(fonts.regular)
    .fontSize(typography.cardTitle)
    .fillColor(colors.brown)
    .text(
      toTitleCase(value),
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
  reportData,
  fonts
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
    cardWidth,
    fonts
  );

  addBadge(
    document,
    "Risk Level",
    reportData.urgency,
    startX + cardWidth + gap,
    y,
    cardWidth,
    fonts,
    getRiskFillColor(reportData.urgency)
  );

  y += 66;

  addBadge(
    document,
    "Affected Component",
    reportData.detectedObject,
    startX,
    y,
    cardWidth,
    fonts
  );

  addBadge(
    document,
    "Estimated Cost",
    reportData.estimatedCostRange,
    startX + cardWidth + gap,
    y,
    cardWidth,
    fonts
  );

  y += 66;

  addBadge(
    document,
    "Repair Category",
    reportData.category,
    startX,
    y,
    cardWidth,
    fonts
  );

  addBadge(
    document,
    "Estimated Time",
    reportData.estimatedRepairTime,
    startX + cardWidth + gap,
    y,
    cardWidth,
    fonts
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

const addFooter = (
  document,
  fonts
) => {
  ensurePageSpace(document, 65);

  document
    .moveDown()
    .font(fonts.regular)
    .fontSize(typography.smallCaption)
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

  const fonts =
    await getPdfFonts();

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

      registerPdfFonts(
        document,
        fonts
      );

      addHeader(
        document,
        reportData,
        logoBuffer,
        fonts
      );

      addImageBlock(
        document,
        imageBuffer,
        imageHeight
      );

      addSectionTitle(
        document,
        "Executive Summary",
        fonts
      );

      addParagraph(
        document,
        technicalReport.executiveSummary,
        "No technical summary was generated.",
        fonts
      );

      addSectionTitle(
        document,
        "Visible Observations",
        fonts
      );

      addList(
        document,
        technicalReport.visibleObservations,
        "No confirmed visual observations were available.",
        fonts
      );

      addSectionTitle(
        document,
        "Technical Assessment",
        fonts
      );

      addParagraph(
        document,
        technicalReport.technicalAssessment,
        "The condition requires an on-site assessment before a final diagnosis can be made.",
        fonts
      );

      addSectionTitle(
        document,
        "Possible Causes",
        fonts
      );

      addList(
        document,
        technicalReport.possibleCauses,
        "Possible underlying causes could not be determined from the submitted image.",
        fonts
      );

      addSectionTitle(
        document,
        "Recommended On-Site Diagnostic Checks",
        fonts
      );

      addList(
        document,
        technicalReport.recommendedDiagnosticChecks,
        "A qualified technician should inspect the affected component and surrounding connections.",
        fonts
      );

      addSectionTitle(
        document,
        "Likely Repair Scope",
        fonts
      );

      addList(
        document,
        technicalReport.likelyRepairScope,
        "The final repair scope must be determined during the on-site inspection.",
        fonts
      );

      addSectionTitle(
        document,
        "Case Overview",
        fonts
      );

      addSummaryGrid(
        document,
        reportData,
        fonts
      );

      addField(
        document,
        "Confidence basis",
        reportData.confidenceReason,
        fonts
      );

      addSectionTitle(
        document,
        "Assessment Limitations",
        fonts
      );

      addParagraph(
        document,
        technicalReport.limitations,
        "This report is based on the submitted image and available FixBee analysis. Hidden damage and the final root cause cannot be confirmed without an on-site inspection.",
        fonts
      );

      addFooter(
        document,
        fonts
      );

      document.end();
    }
  );
};

export {
  generateIssueReportPdf,
};
