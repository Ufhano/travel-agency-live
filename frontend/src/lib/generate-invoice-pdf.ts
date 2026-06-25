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

/** Build a PDF blob from the on-screen invoice (#invoice-print). */
export async function generateInvoicePdfBlob(
  _invoiceNumber: string,
): Promise<Blob> {
  const node = document.getElementById("invoice-print");
  if (!node) throw new Error("Invoice not found on page.");

  // Remember the user's scroll position so we can restore it after capture.
  const prevScrollX = window.scrollX;
  const prevScrollY = window.scrollY;

  node.scrollIntoView({ block: "start" });
  await document.fonts.ready;
  await waitForImages(node);
  // Allow layout to settle after scroll
  await new Promise((r) => setTimeout(r, 150));

  const prevOverflow = node.style.overflow;
  const prevHeight = node.style.height;
  node.style.overflow = "visible";
  node.style.height = "auto";

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const width = node.scrollWidth;
    const height = node.scrollHeight;

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: -window.scrollY,
      onclone: (clonedDoc) => {
        const cloned = clonedDoc.getElementById("invoice-print");
        if (cloned) {
          cloned.style.overflow = "visible";
          cloned.style.height = "auto";
          cloned.style.maxWidth = "none";
          cloned.style.boxShadow = "none";
          // Drop screen-only controls (e.g. the inline "Edit terms" button) so
          // they never appear in the captured PDF.
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

    // Always render the whole invoice (header, table, terms, signature, footer)
    // onto a SINGLE A4 page. Fit the capture inside the page while preserving
    // its aspect ratio, so nothing — especially the signature and terms — ever
    // spills onto a second page.
    const imgData = canvas.toDataURL("image/png", 1.0);
    const canvasRatio = canvas.width / canvas.height;
    const pageRatio = pageWidth / pageHeight;

    let renderWidth: number;
    let renderHeight: number;
    if (canvasRatio >= pageRatio) {
      // Wider than the page proportionally — constrain by width.
      renderWidth = pageWidth;
      renderHeight = pageWidth / canvasRatio;
    } else {
      // Taller than the page proportionally — constrain by height.
      renderHeight = pageHeight;
      renderWidth = pageHeight * canvasRatio;
    }

    // Centre horizontally; pin to the top so the layout reads naturally.
    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = 0;

    pdf.addImage(
      imgData,
      "PNG",
      offsetX,
      offsetY,
      renderWidth,
      renderHeight,
      undefined,
      "FAST",
    );

    return pdf.output("blob") as Blob;
  } finally {
    node.style.overflow = prevOverflow;
    node.style.height = prevHeight;
    // Return the user to where they were before the capture scrolled the page.
    window.scrollTo(prevScrollX, prevScrollY);
  }
}

export function invoicePdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "-");
  return `Invoice-${safe}.pdf`;
}
