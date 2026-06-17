import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// ─── Why puppeteer-core + @sparticuz/chromium ─────────────────────────────────
// Full `puppeteer` bundles its own ~300MB Chromium download during npm install.
// On Render's free tier this frequently times out the build step or blows
// past the slug size limit.
//
// `puppeteer-core` ships with NO browser at all — you provide the executable.
// `@sparticuz/chromium` provides a Chromium binary built specifically for
// serverless/constrained environments (AWS Lambda, Render, etc.) — much smaller
// and works reliably in these environments.
//
// In LOCAL DEVELOPMENT, @sparticuz/chromium may not work on Windows/Mac.
// We fall back to a locally installed Chrome/Edge if CHROME_PATH is set.

let browserInstance = null;

async function getBrowser() {
  // Reuse the same browser instance across requests — launching Chromium
  // takes ~1-2 seconds, which would be wasteful per-request
  if (browserInstance && browserInstance.process() != null) {
    return browserInstance;
  }

  const isLocal = process.env.NODE_ENV !== "production";

  if (isLocal && process.env.CHROME_PATH) {
    // Local dev: use your installed Chrome/Edge
    // Set CHROME_PATH in .env, e.g.:
    //   Windows: C:\Program Files\Google\Chrome\Application\chrome.exe
    //   Mac:     /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
    browserInstance = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
    });
  } else {
    // Production (Render) or local without CHROME_PATH set
    browserInstance = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  return browserInstance;
}

// ─── Generate PDF from HTML string ────────────────────────────────────────────
// Returns a Buffer — ready to upload to Supabase Storage or send as response
export async function generatePdfFromHtml(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    return pdfBuffer;
  } finally {
    // Close the page but keep the browser instance alive for reuse
    await page.close();
  }
}

// ─── Cleanup on server shutdown ────────────────────────────────────────────────
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
