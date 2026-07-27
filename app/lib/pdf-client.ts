export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  let document;
  try {
    document = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("password")) {
      throw new Error("This PDF is password-protected. Download or save an unlocked statement and try again.");
    }
    throw new Error("The PDF could not be opened. Try downloading the statement again.");
  }

  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        return [{
          text: item.str.trim(),
          x: item.transform?.[4] ?? 0,
          y: item.transform?.[5] ?? 0,
        }];
      })
      .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);

    let currentY: number | null = null;
    let currentLine: string[] = [];
    for (const item of items) {
      if (currentY === null || Math.abs(currentY - item.y) <= 2) {
        currentLine.push(item.text);
        currentY ??= item.y;
      } else {
        if (currentLine.length) lines.push(currentLine.join(" "));
        currentLine = [item.text];
        currentY = item.y;
      }
    }
    if (currentLine.length) lines.push(currentLine.join(" "));
  }

  if (!lines.join(" ").trim()) {
    throw new Error("No readable text was found. Scanned-image PDFs need OCR before they can be imported.");
  }
  return lines;
}
