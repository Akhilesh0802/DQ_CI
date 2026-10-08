// Data Metrics PDF - reference script (reportlab wala export_pdf) ke layout ka jsPDF port. Browser mein banta hai.
//
// Layout (reference ke jaisa):
//   - A4 portrait, 20 mm margin
//   - Title "DATA METRICS REPORT" + metadata (file name, run date ...)
//   - Har COLUMN ka alag section: column name, neeche metric/value ke 2 groups side-by-side, phir separator line
//   - Order: NUMERIC -> DATE -> TEXT -> BOOLEAN
//   - Ek page par 2 column sections
//   - Footer mein "Page N"
import { jsPDF } from "jspdf";
import { ColumnProfile, ColumnMetricItem, Dataset, Profile } from "./types";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const SECTIONS_PER_PAGE = 2;

// Metric table ke column x-positions (mm, page ke left edge se): [label 35][value 27][gap 25][label 40][value 27] = 154 mm
const TABLE_WIDTH = 154;
const LEFT_LABEL_X = MARGIN;
const LEFT_VALUE_RIGHT_X = MARGIN + 35 + 27 - 1;
const RIGHT_LABEL_X = MARGIN + 35 + 27 + 25;
const RIGHT_VALUE_RIGHT_X = MARGIN + 35 + 27 + 25 + 40 + 27 - 1;
const LEFT_LABEL_WIDTH = 35 - 1;
const RIGHT_LABEL_WIDTH = 40 - 1;
const VALUE_WIDTH = 27 - 1;

const ROW_HEIGHT = 4.6; // 13 pt: 10 pt leading + padding
const HEADING_HEIGHT = 7;
const SECTION_GAP = 18;

const TYPE_ORDER: ColumnProfile["inferred_type"][] = ["NUMERIC", "DATE", "TEXT", "BOOLEAN"];

type PdfDoc = jsPDF;

// ---------------------------------------------------------------- value formatting (reference ke format_metric_value jaisa)

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDate(value: string): string {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : value;
}

function formatMetricValue(metric: ColumnMetricItem, type: ColumnProfile["inferred_type"]): string {
  const value = metric.value;
  if (value === null || value === undefined || value === "") return "";

  if (type === "DATE" && (metric.key === "earliest_date" || metric.key === "latest_date")) {
    return formatDate(String(value));
  }
  if (metric.key === "most_common_value" || metric.key === "least_common_value") return String(value);

  if (typeof value === "number") return formatNumber(value);
  const asNumber = Number(value);
  if (value.trim() !== "" && Number.isFinite(asNumber)) return formatNumber(asNumber);
  return String(value);
}

// Text ko width mein fit karta hai (lamba ho toh ... laga deta hai)
function fitText(doc: PdfDoc, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function formatRunDate(): string {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// ---------------------------------------------------------------- drawing

function drawTitleAndMetadata(doc: PdfDoc, dataset: Dataset, profile: Profile): number {
  let y = MARGIN + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("DATA METRICS REPORT", MARGIN, y);
  y += 8;

  const rows: [string, string][] = [
    ["File Name:", dataset.file_name],
    ["System:", dataset.system ?? "-"],
    ["Reporting Period:", dataset.reporting_period ?? "-"],
    ["Total Records:", formatNumber(profile.row_count ?? dataset.record_count ?? 0)],
    ["Run Date:", formatRunDate()],
  ];
  doc.setFontSize(8);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(fitText(doc, value, 115), MARGIN + 35, y);
    y += 4.4;
  }
  return y + 6;
}

function sectionHeight(metricCount: number): number {
  const rowCount = Math.ceil(metricCount / 2);
  return HEADING_HEIGHT + rowCount * ROW_HEIGHT + 4;
}

// Ek column ka section: heading + do groups (left/right) + separator. Section ke baad ki y return karta hai.
function drawColumnSection(doc: PdfDoc, col: ColumnProfile, y: number): number {
  const metrics = col.metrics;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(fitText(doc, col.column_name, TABLE_WIDTH), MARGIN, y + 4);
  let cursor = y + HEADING_HEIGHT;

  const midpoint = Math.ceil(metrics.length / 2);
  const left = metrics.slice(0, midpoint);
  const right = metrics.slice(midpoint);

  doc.setFontSize(8.5);
  for (let i = 0; i < left.length; i++) {
    const baseline = cursor + 3.2;

    doc.setFont("helvetica", "normal");
    doc.text(fitText(doc, left[i].label, LEFT_LABEL_WIDTH), LEFT_LABEL_X, baseline);
    doc.text(fitText(doc, formatMetricValue(left[i], col.inferred_type), VALUE_WIDTH), LEFT_VALUE_RIGHT_X, baseline, { align: "right" });

    const r = right[i];
    if (r) {
      doc.text(fitText(doc, r.label, RIGHT_LABEL_WIDTH), RIGHT_LABEL_X, baseline);
      doc.text(fitText(doc, formatMetricValue(r, col.inferred_type), VALUE_WIDTH), RIGHT_VALUE_RIGHT_X, baseline, { align: "right" });
    }
    cursor += ROW_HEIGHT;
  }

  // separator line
  cursor += 2;
  doc.setDrawColor(183, 183, 183);
  doc.setLineWidth(0.18);
  doc.line(MARGIN, cursor, MARGIN + TABLE_WIDTH, cursor);
  return cursor + 2;
}

function drawPageNumbers(doc: PdfDoc) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(85, 85, 85);
    doc.text(`Page ${i}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12, { align: "right" });
  }
}

// ---------------------------------------------------------------- public

export function downloadSummaryPdf(dataset: Dataset, profile: Profile) {
  const doc: PdfDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setProperties({ title: `Data Metrics - ${dataset.file_name}` });

  let y = drawTitleAndMetadata(doc, dataset, profile);

  const ordered: ColumnProfile[] = TYPE_ORDER.flatMap((type) =>
    (profile.columns ?? []).filter((c) => c.inferred_type === type && c.metrics.length > 0)
  );

  if (ordered.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Column metrics are not available for this dataset (older upload). Upload it again to get them.", MARGIN, y);
  }

  let sectionsOnPage = 0;
  for (const col of ordered) {
    const needed = sectionHeight(col.metrics.length);
    const noSpace = y + needed > PAGE_HEIGHT - MARGIN;
    // Reference ki tarah: ek page par 2 sections
    if (sectionsOnPage >= SECTIONS_PER_PAGE || (noSpace && sectionsOnPage > 0)) {
      doc.addPage();
      y = MARGIN;
      sectionsOnPage = 0;
    }
    y = drawColumnSection(doc, col, y) + SECTION_GAP;
    sectionsOnPage += 1;
  }

  drawPageNumbers(doc);

  const baseName = dataset.file_name.replace(/\.[^.]+$/, "");
  doc.save(`${baseName}-v${dataset.version_number ?? 1}-data-metrics.pdf`);
}
