import PDFDocument from "pdfkit";

const clean = (value) => {
  return String(value ?? "").trim();
};

const getDisplayValue = (value) => {
  return clean(value) || "N/A";
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

      if (item && typeof item === "object") {
        return clean(
          item.description ||
            item.label ||
            item.title
        );
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

  document
    .moveDown(0.7)
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#4A2F0B")
    .text(title);

  document
    .moveTo(50, document.y + 4)
    .lineTo(
      document.page.width - 50,
      document.y + 4
    )
    .strokeColor("#FBB800")
    .stroke();

  document.moveDown(0.8);
};

const addField = (
  document,
  label,
  value
) => {
  ensurePageSpace(document, 35);

  document
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor("#4A2F0B")
    .text(`${label}: `, {
      continued: true,
    })
    .font("Helvetica")
    .fillColor("#202020")
    .text(getDisplayValue(value));

  document.moveDown(0.35);
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
      .fillColor("#666666")
      .text(emptyMessage);

    return;
  }

  normalizedItems.forEach((item) => {
    ensurePageSpace(document, 35);

    document
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor("#202020")
      .text(`• ${item}`, {
        indent: 10,
        paragraphGap: 5,
      });
  });
};

const downloadImage = async (imageUrl) => {
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
      response.headers.get("content-type") ||
      "";

    const isSupportedImage =
      contentType.includes("image/jpeg") ||
      contentType.includes("image/png");

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
  const imageBuffer = await downloadImage(
    reportData.imageUrl
  );

  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: "FixBee Issue Report",
        Author: "FixBee",
      },
    });

    const chunks = [];

    document.on("data", (chunk) => {
      chunks.push(chunk);
    });

    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    document.on("error", reject);

    /*
     * Report header
     */
    document
      .rect(
        0,
        0,
        document.page.width,
        90
      )
      .fill("#FDE68A");

    document
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#4A2F0B")
      .text(
        "FixBee Issue Report",
        50,
        30
      );

    document
      .font("Helvetica")
      .fontSize(10)
      .text(
        `Report ID: ${getDisplayValue(
          reportData.photoId
        )}`,
        50,
        62
      );

    document.y = 115;

    /*
     * Analyzed image
     */
    if (imageBuffer) {
      try {
        const imageTop = document.y;

        document.image(
          imageBuffer,
          50,
          imageTop,
          {
            fit: [
              document.page.width - 100,
              190,
            ],
            align: "center",
            valign: "center",
          }
        );

        document.y = imageTop + 205;
      } catch (error) {
        console.warn(
          "[FixBee][PDF] image could not be inserted",
          error.message
        );
      }
    }

    /*
     * Issue information
     */
    addSectionTitle(
      document,
      "Issue Summary"
    );

    addField(
      document,
      "Detected issue",
      reportData.detectedIssue
    );

    addField(
      document,
      "Detected object",
      reportData.detectedObject
    );

    addField(
      document,
      "Category",
      reportData.category
    );

    addField(
      document,
      "Risk level",
      reportData.urgency
    );

    addField(
      document,
      "Analysis confidence",
      reportData.confidence
    );

    /*
     * Repair estimate
     */
    addSectionTitle(
      document,
      "Repair Estimate"
    );

    addField(
      document,
      "Estimated cost",
      reportData.estimatedCostRange
    );

    addField(
      document,
      "Estimated repair time",
      reportData.estimatedRepairTime
    );

    addField(
      document,
      "Recommended provider",
      reportData.providerType
    );

    /*
     * Issues and recommendations
     */
    addSectionTitle(
      document,
      "Issues to Fix"
    );

    addList(
      document,
      reportData.issuesToFix,
      "No specific issues were provided."
    );

    addSectionTitle(
      document,
      "Recommended Actions"
    );

    addList(
      document,
      reportData.recommendedActions,
      "No recommended actions were provided."
    );

    /*
     * Requester information
     */
    const requester =
      reportData.requester || {};

    const serviceRequest =
      reportData.serviceRequest || {};

    addSectionTitle(
      document,
      "Service Request"
    );

    addField(
      document,
      "Requester",
      requester.name
    );

    addField(
      document,
      "Email",
      requester.email
    );

    addField(
      document,
      "Address",
      serviceRequest.address
    );

    addField(
      document,
      "City",
      serviceRequest.city
    );

    addField(
      document,
      "Preferred date",
      serviceRequest.preferredDate
    );

    addField(
      document,
      "Preferred time",
      serviceRequest.preferredTime
    );

    addField(
      document,
      "Additional notes",
      serviceRequest.notes
    );

    /*
     * Disclaimer
     */
    ensurePageSpace(document, 60);

    document
      .moveDown()
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#666666")
      .text(
        "This FixBee report is based on image analysis and is provided to support a service quote request. A qualified professional should confirm the final diagnosis and repair requirements.",
        {
          align: "center",
        }
      );

    document.end();
  });
};

export {
  generateIssueReportPdf,
};