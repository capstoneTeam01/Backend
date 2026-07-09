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

const addParagraph = (
  document,
  value,
  emptyMessage
) => {
  ensurePageSpace(document, 60);

  document
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor("#202020")
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
      .fillColor("#666666")
      .text(emptyMessage);

    return;
  }

  normalizedItems.forEach((item) => {
    ensurePageSpace(document, 40);

    document
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor("#202020")
      .text(`• ${item}`, {
        indent: 10,
        lineGap: 2,
        paragraphGap: 6,
      });
  });
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
  const imageBuffer =
    await downloadImage(
      reportData.imageUrl
    );

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

      /*
       * Header
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
        .fontSize(22)
        .fillColor("#4A2F0B")
        .text(
          "FixBee Expert Technical Assessment",
          50,
          27
        );

      document
        .font("Helvetica")
        .fontSize(9.5)
        .text(
          `Report ID: ${getDisplayValue(
            reportData.photoId
          )}`,
          50,
          62
        );

      document.y = 115;

      /*
       * Submitted issue image
       */
      if (imageBuffer) {
        try {
          const imageTop =
            document.y;

          document.image(
            imageBuffer,
            50,
            imageTop,
            {
              fit: [
                document.page.width -
                  100,
                190,
              ],

              align: "center",
              valign: "center",
            }
          );

          document.y =
            imageTop + 205;
        } catch (error) {
          console.warn(
            "[FixBee][PDF] image could not be inserted",
            error.message
          );
        }
      }

      /*
       * Basic case information
       */
      addSectionTitle(
        document,
        "Case Overview"
      );

      addField(
        document,
        "Detected issue",
        reportData.detectedIssue
      );

      addField(
        document,
        "Affected component",
        reportData.detectedObject
      );

      addField(
        document,
        "Repair category",
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

      addField(
        document,
        "Confidence basis",
        reportData.confidenceReason
      );

      /*
       * Expert technical report
       */
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
        "Risk Assessment"
      );

      addParagraph(
        document,
        technicalReport.riskAssessment,
        "The technician should confirm the current risk level before beginning work."
      );

      addSectionTitle(
        document,
        "Immediate Precautions"
      );

      addList(
        document,
        technicalReport.immediatePrecautions,
        "Limit use of the affected fixture until the condition has been inspected."
      );

      /*
       * Preliminary estimates
       */
      addSectionTitle(
        document,
        "Preliminary Repair Estimate"
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
       * Assessment limitations
       */
      addSectionTitle(
        document,
        "Assessment Limitations"
      );

      addParagraph(
        document,
        technicalReport.limitations,
        "This report is based on the submitted image and available FixBee analysis. Hidden damage and the final root cause cannot be confirmed without an on-site inspection."
      );

      ensurePageSpace(
        document,
        65
      );

      document
        .moveDown()
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#666666")
        .text(
          "This report provides a preliminary technical assessment for quotation purposes. It is not a final diagnosis, inspection certificate, repair authorization, or confirmation of code compliance. A qualified service professional must verify the condition and repair requirements on site.",
          {
            align: "center",
            lineGap: 2,
          }
        );

      document.end();
    }
  );
};

export {
  generateIssueReportPdf,
};
