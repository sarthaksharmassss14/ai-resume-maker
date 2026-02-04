// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

export interface ExtractedLink {
    url: string;
    text: string;
    page: number;
    rect: number[];
}

/**
 * Extracts text AND embedded links from PDF using pdfjs-dist.
 * Injects links into the text stream as "[Link: <url>]" for the AI to read.
 */
export async function extractTextWithLinks(buffer: Buffer): Promise<string> {
    try {
        // Convert Buffer to Uint8Array for pdfjs
        const data = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({ data, disableFontFace: true, useSystemFonts: true });
        const doc = await loadingTask.promise;

        let fullText = "";

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const annotations = await page.getAnnotations();

            // Create a text string for the page
            let pageText = textContent.items.map((item: any) => item.str).join(" ");

            // Process links
            // This is a simplified approach: we append the links found on the page to the end of the text segment 
            // where they might belong, or just list them. 
            // A perfect spatial mapping is hard, but appending them near relevant keywords or just listing them works for LLMs.
            // BETTER STRATEGY: 
            // Since we can't easily map exact coordinates to text index in this simple script,
            // we will collect all links and append them at the end of the page text with a clear marker.
            // OR: We try to match the link URL to the text if the text *is* the URL.
            // BUT: If the text is "Click Here", we lose it.

            // Strategy: Append a "Links Found:" section to the text of each page.
            if (annotations && annotations.length > 0) {
                const links = annotations
                    .filter((a: any) => a.subtype === 'Link' && a.url)
                    .map((a: any) => `[Link: ${a.url}]`);

                if (links.length > 0) {
                    pageText += "\n\n--- Links on this page ---\n" + links.join("\n") + "\n------------------------\n";
                }
            }

            fullText += pageText + "\\n\\n";
        }

        return fullText;

    } catch (error) {
        console.error("PDFJS Parse Error:", error);
        // Fallback to basic text extraction if PDFJS fails (e.g. some complex PDFs)
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            return data.text + "\\n\\n(Note: Deep link extraction failed, only visible text available)";
        } catch (e) {
            throw new Error("Failed to parse PDF file");
        }
    }
}

// Deprecated but kept for interface compatibility
export async function extractLinksFromPdfBuffer(buffer: Buffer): Promise<ExtractedLink[]> {
    return [];
}
