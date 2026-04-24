import jsPDF from "jspdf";

export interface NexusPdfMetric {
  label: string;
  value: string;
  note?: string;
}

export interface NexusPdfSection {
  title: string;
  lines: string[];
}

export interface NexusPdfTable {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}

export interface NexusPdfMetaItem {
  label: string;
  value: string;
}

export interface NexusPdfReportInput {
  fileName: string;
  reportTitle: string;
  reportSubtitle?: string;
  generatedAt?: string;
  meta?: NexusPdfMetaItem[];
  metrics?: NexusPdfMetric[];
  sections?: NexusPdfSection[];
  tables?: NexusPdfTable[];
  footerNote?: string;
}

const COLORS = {
  navy: [26, 26, 61] as const,
  indigo: [79, 70, 229] as const,
  violet: [124, 58, 237] as const,
  slate: [71, 85, 105] as const,
  border: [226, 232, 240] as const,
  text: [15, 23, 42] as const,
};

const PAGE_PADDING = 36;
const BANNER_HEIGHT = 124;

type PdfDoc = jsPDF;

const safeText = (value: unknown) => {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "-";
  }
  const text = String(value).trim();
  return text || "-";
};

const addFooter = (doc: PdfDoc, footerNote: string | undefined) => {
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.6);
    doc.line(PAGE_PADDING, pageHeight - 26, pageWidth - PAGE_PADDING, pageHeight - 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.slate);
    doc.text(`Nexus report · Page ${page} of ${totalPages}`, PAGE_PADDING, pageHeight - 14);
    if (footerNote) {
      const noteWidth = doc.getTextWidth(footerNote);
      doc.text(footerNote, pageWidth - PAGE_PADDING - noteWidth, pageHeight - 14);
    }
  }
}

export const downloadNexusPdfReport = (input: NexusPdfReportInput) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let cursorY = PAGE_PADDING + 4;

  const drawBanner = () => {
    doc.setFillColor(...COLORS.navy);
    doc.rect(0, 0, pageWidth, BANNER_HEIGHT, "F");

    doc.setFillColor(...COLORS.indigo);
    doc.circle(PAGE_PADDING + 14, 28, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("N", PAGE_PADDING + 10, 32);

    doc.setFontSize(13);
    doc.text("NEXUS", PAGE_PADDING + 38, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Community operations report", PAGE_PADDING + 38, 38);

    const generatedLabel = input.generatedAt ? new Date(input.generatedAt).toLocaleString() : new Date().toLocaleString();
    const generatedWidth = doc.getTextWidth(generatedLabel);
    doc.text(generatedLabel, pageWidth - PAGE_PADDING - generatedWidth, 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(input.reportTitle, pageWidth - (PAGE_PADDING * 2));
    doc.text(titleLines, PAGE_PADDING, 60);

    if (input.reportSubtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(226, 232, 240);
      const subtitleLines = doc.splitTextToSize(input.reportSubtitle, pageWidth - (PAGE_PADDING * 2));
      doc.text(subtitleLines, PAGE_PADDING, 78);
    }

    if (input.meta?.length) {
      const metaY = 98;
      const visibleMeta = input.meta.slice(0, 3);
      const metaBoxWidth = Math.min(160, (pageWidth - PAGE_PADDING * 2 - 16) / visibleMeta.length);
      visibleMeta.forEach((item, index) => {
        const x = PAGE_PADDING + index * (metaBoxWidth + 8);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, metaY - 16, metaBoxWidth, 30, 8, 8, "FD");
        doc.setTextColor(...COLORS.navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(item.label.toUpperCase(), x + 8, metaY - 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(safeText(item.value), x + 8, metaY + 10);
      });
    }

    cursorY = BANNER_HEIGHT + 22;
    doc.setTextColor(...COLORS.text);
  };

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - 42) {
      return;
    }
    doc.addPage();
    cursorY = PAGE_PADDING + 4;
    drawBanner();
  };

  const addMetricGrid = (metrics: NexusPdfMetric[]) => {
    if (!metrics.length) {
      return;
    }

    const cols = metrics.length >= 4 ? 4 : metrics.length >= 3 ? 3 : 2;
    const gap = 12;
    const cardWidth = (pageWidth - PAGE_PADDING * 2 - gap * (cols - 1)) / cols;
    const cardHeight = 82;
    const rows = Math.ceil(metrics.length / cols);

    ensureSpace(rows * (cardHeight + gap) + 10);

    metrics.forEach((metric, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = PAGE_PADDING + col * (cardWidth + gap);
      const y = cursorY + row * (cardHeight + gap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...COLORS.border);
      doc.roundedRect(x, y, cardWidth, cardHeight, 12, 12, "FD");
      doc.setTextColor(...COLORS.slate);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(metric.label.toUpperCase(), x + 12, y + 20);
      doc.setTextColor(...COLORS.navy);
      doc.setFontSize(18);
      doc.text(metric.value, x + 12, y + 44);
      if (metric.note) {
        doc.setTextColor(...COLORS.slate);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const noteLines = doc.splitTextToSize(metric.note, cardWidth - 24);
        doc.text(noteLines, x + 12, y + 62);
      }
    });

    cursorY += rows * (cardHeight + gap) + 4;
  };

  const addSection = (section: NexusPdfSection) => {
    ensureSpace(32);
    doc.setTextColor(...COLORS.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(section.title, PAGE_PADDING, cursorY);
    cursorY += 12;

    section.lines.forEach((line) => {
      const textLines = doc.splitTextToSize(`- ${safeText(line)}`, pageWidth - PAGE_PADDING * 2);
      ensureSpace(textLines.length * 13 + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.text);
      doc.text(textLines, PAGE_PADDING, cursorY);
      cursorY += textLines.length * 13 + 2;
    });

    cursorY += 8;
  };

  const addTable = (table: NexusPdfTable) => {
    const cols = table.headers.length;
    if (!cols) {
      return;
    }

    const colWidths = Array(cols).fill((pageWidth - PAGE_PADDING * 2) / cols);
    const lineHeight = 12;

    const drawHeader = () => {
      ensureSpace(32);
      doc.setTextColor(...COLORS.navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(table.title, PAGE_PADDING, cursorY);
      cursorY += 14;

      const headerHeight = 28;
      let x = PAGE_PADDING;
      table.headers.forEach((header, index) => {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(...COLORS.border);
        doc.roundedRect(x, cursorY, colWidths[index], headerHeight, 6, 6, "FD");
        doc.setTextColor(...COLORS.navy);
        doc.setFontSize(8.5);
        doc.text(header, x + colWidths[index] / 2, cursorY + 18, { align: "center" });
        x += colWidths[index];
      });
      cursorY += headerHeight + 4;
      doc.setTextColor(...COLORS.text);
    };

    drawHeader();

    table.rows.forEach((row, rowIndex) => {
      const wrapped = row.map((cell, index) => doc.splitTextToSize(safeText(cell), colWidths[index] - 12));
      const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + 10;
      if (cursorY + rowHeight > pageHeight - 42) {
        doc.addPage();
        cursorY = PAGE_PADDING + 4;
        drawBanner();
        drawHeader();
      }

      let x = PAGE_PADDING;
      const fill = rowIndex % 2 === 0 ? 255 : 249;
      table.headers.forEach((_, index) => {
        doc.setFillColor(fill, fill, fill);
        doc.setDrawColor(...COLORS.border);
        doc.rect(x, cursorY, colWidths[index], rowHeight, "FD");
        const lines = wrapped[index];
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.text);
        doc.text(lines, x + 6, cursorY + 15);
        x += colWidths[index];
      });
      cursorY += rowHeight;
    });

    cursorY += 10;
  };

  drawBanner();
  if (input.metrics?.length) {
    addMetricGrid(input.metrics);
  }
  input.sections?.forEach((section) => addSection(section));
  input.tables?.forEach((table) => addTable(table));

  addFooter(doc, input.footerNote);
  doc.save(input.fileName);
};