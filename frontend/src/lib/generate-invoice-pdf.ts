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

    // Slice the canvas into page-sized chunks (avoids blank / misaligned pages)
    const sliceHeightPx = Math.floor((canvas.width * pageHeight) / pageWidth);
    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      const chunkHeight = Math.min(sliceHeightPx, canvas.height - offsetY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = chunkHeight;
      const ctx = pageCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not create PDF canvas.");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        chunkHeight,
        0,
        0,
        canvas.width,
        chunkHeight,
      );

      const imgData = pageCanvas.toDataURL("image/png", 1.0);
      const chunkPdfHeight = (chunkHeight * pageWidth) / canvas.width;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, chunkPdfHeight, undefined, "FAST");

      offsetY += chunkHeight;
      pageIndex += 1;
    }

    return pdf.output("blob") as Blob;
  } finally {
    node.style.overflow = prevOverflow;
    node.style.height = prevHeight;
  }
}

export function invoicePdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "-");
  return `Invoice-${safe}.pdf`;
}
