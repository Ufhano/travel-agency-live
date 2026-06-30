const PAGE_MARGIN_MM = 10;

function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}

function supportsZoom(): boolean {
  return (
    typeof CSS !== "undefined" &&
    "zoom" in (document.createElement("div").style as CSSStyleDeclaration)
  );
}

/** Apply compact one-page layout (mirrors @media print rules) before measuring. */
export function applyInvoiceOnePageLayout(): void {
  document.getElementById("invoice-print")?.classList.add("invoice-one-page");
}

export function clearInvoiceOnePageLayout(): void {
  const node = document.getElementById("invoice-print");
  if (!node) return;
  node.classList.remove("invoice-one-page");
  node.style.removeProperty("zoom");
  node.style.removeProperty("transform");
  node.style.removeProperty("transformOrigin");
  node.style.removeProperty("width");
  node.style.removeProperty("marginLeft");
  node.style.removeProperty("marginRight");
}

/**
 * Scale the invoice to fit one printed page when the compact layout still overflows.
 */
export function prepareInvoiceForPrint(): void {
  const node = document.getElementById("invoice-print");
  if (!node) return;

  clearInvoiceOnePageLayout();
  applyInvoiceOnePageLayout();

  const printableWidthPx = mmToPx(210 - PAGE_MARGIN_MM * 2);
  const printableHeightPx = mmToPx(297 - PAGE_MARGIN_MM * 2);

  const contentWidth = node.scrollWidth;
  const contentHeight = node.scrollHeight;
  const scale = Math.min(
    printableWidthPx / contentWidth,
    printableHeightPx / contentHeight,
  );
  const rounded = Math.floor(scale * 1000) / 1000;

  if (rounded < 1) {
    if (supportsZoom()) {
      node.style.zoom = String(rounded);
    } else {
      node.style.transform = `scale(${rounded})`;
      node.style.transformOrigin = "top center";
      node.style.width = `${contentWidth * rounded}px`;
      node.style.marginLeft = "auto";
      node.style.marginRight = "auto";
    }
  }
}

export function printInvoice(invoiceNumber: string): void {
  const originalTitle = document.title;
  document.title = `Invoice ${invoiceNumber}`;

  const restore = () => {
    document.title = originalTitle;
    clearInvoiceOnePageLayout();
    window.removeEventListener("afterprint", restore);
  };

  window.addEventListener("afterprint", restore);

  void document.fonts.ready.then(() => {
    prepareInvoiceForPrint();
    requestAnimationFrame(() => window.print());
  });
}

export { PAGE_MARGIN_MM };
