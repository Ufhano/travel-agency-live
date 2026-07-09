import {
  applyInvoiceOnePageLayout,
  clearInvoiceOnePageLayout,
  PAGE_MARGIN_MM,
} from "./invoice-print";

/** Wait for all images inside the invoice to finish loading. */
function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        }),
    ),
  ).then(() => undefined);
}

const CAPTURE_WIDTH_PX = 896;

function measureInvoiceHeight(node: HTMLElement): number {
  const top = node.getBoundingClientRect().top;
  let bottom = node.scrollHeight;
  const footer = node.querySelector(".invoice-footer-group");
  if (footer) {
    bottom = Math.max(bottom, footer.getBoundingClientRect().bottom - top);
  }
  return Math.ceil(bottom + 4);
}

/** Build a PDF blob from the on-screen invoice (#invoice-print). */
export async function generateInvoicePdfBlob(
  _invoiceNumber: string,
): Promise<Blob> {
  const node = document.getElementById("invoice-print");
  if (!node) throw new Error("Invoice not found on page.");

  const prevScrollX = window.scrollX;
  const prevScrollY = window.scrollY;
  const prevWidth = node.style.width;
  const prevMaxWidth = node.style.maxWidth;
  const prevOverflow = node.style.overflow;
  const prevHeight = node.style.height;

  node.scrollIntoView({ block: "start" });
  await document.fonts.ready;
  await waitForImages(node);

  applyInvoiceOnePageLayout();
  node.style.width = `${CAPTURE_WIDTH_PX}px`;
  node.style.maxWidth = `${CAPTURE_WIDTH_PX}px`;
  node.style.overflow = "visible";
  node.style.height = "auto";

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 150));

  try {
    const captureHeight = measureInvoiceHeight(node);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: CAPTURE_WIDTH_PX,
      height: captureHeight,
      windowWidth: CAPTURE_WIDTH_PX,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const cloned = clonedDoc.getElementById("invoice-print");
        if (cloned) {
          cloned.classList.add("invoice-one-page");
          cloned.style.overflow = "visible";
          cloned.style.height = "auto";
          cloned.style.width = `${CAPTURE_WIDTH_PX}px`;
          cloned.style.maxWidth = `${CAPTURE_WIDTH_PX}px`;
          cloned.style.boxShadow = "none";
          cloned.querySelectorAll(".no-print").forEach((el) => el.remove());
        }
        clonedDoc.querySelectorAll("img").forEach((img) => {
          const el = img as HTMLImageElement;
          if (el.src) {
            el.removeAttribute("loading");
            el.style.maxWidth = "100%";
          }
        });
      },
    });

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const innerWidth = pageWidth - PAGE_MARGIN_MM * 2;
    const innerHeight = pageHeight - PAGE_MARGIN_MM * 2;

    const imgData = canvas.toDataURL("image/png", 1.0);
    const aspect = canvas.height / canvas.width;
    const naturalHeightMm = innerWidth * aspect;
    const scale = Math.min(1, innerHeight / naturalHeightMm);
    const renderWidth = innerWidth * scale;
    const renderHeight = naturalHeightMm * scale;

    pdf.addImage(
      imgData,
      "PNG",
      PAGE_MARGIN_MM + (innerWidth - renderWidth) / 2,
      PAGE_MARGIN_MM,
      renderWidth,
      renderHeight,
      undefined,
      "FAST",
    );

    return pdf.output("blob") as Blob;
  } finally {
    clearInvoiceOnePageLayout();
    node.style.width = prevWidth;
    node.style.maxWidth = prevMaxWidth;
    node.style.overflow = prevOverflow;
    node.style.height = prevHeight;
    window.scrollTo(prevScrollX, prevScrollY);
  }
}

export function invoicePdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "-");
  return `Invoice-${safe}.pdf`;
}
