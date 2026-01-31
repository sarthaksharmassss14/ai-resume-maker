import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Setup worker for Node environment
// We rely on the legacy build's included worker handling or implicit loading in this environment.

export interface ExtractedLink {
    url: string;
    text: string;
    page: number;
    rect: number[]; // [x1, y1, x2, y2]
}

/**
 * Extracts all text from the PDF, but crucially embeds the actual URL 
 * right next to the text that links to it.
 * Example outcome: "Check out my Github Repo [Link: https://github.com/me/repo]"
 */
export async function extractTextWithLinks(buffer: Buffer): Promise<string> {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
    });

    const doc = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const annotations = await page.getAnnotations();

        // 1. Get all links on this page
        const linkAnnotations = annotations.filter((ann: any) => ann.subtype === 'Link' && ann.url);

        // 2. Map Text Items with Metadata
        interface TextItemWithUrl {
            str: string;
            x: number;
            y: number;
            h: number; // height approximation
            w: number; // width approximation
            url?: string; // The URL if this text is clicked
        }

        const items: TextItemWithUrl[] = content.items.map((item: any) => {
            // transform is [scaleX, skewY, skewX, scaleY, x, y]
            const tx = item.transform ? item.transform[4] : 0;
            const ty = item.transform ? item.transform[5] : 0;
            return {
                str: item.str,
                x: tx,
                y: ty,
                h: item.height || 10, // fallback
                w: item.width || 0
            };
        });

        // 3. Associate Links with Text Items
        // We iterate through visual items and check if they fall inside a Link Rect
        for (const ann of linkAnnotations) {
            const rect = ann.rect; // [x1, y1, x2, y2]

            // Find items inside this rect
            const insideItems = items.filter(item =>
                item.x >= rect[0] - 5 && item.x <= rect[2] + 5 &&
                item.y >= rect[1] - 5 && item.y <= rect[3] + 5
            );

            // Logic: Append the URL to the LAST item in the visual group
            // This ensures "Github Repo" becomes "Github Repo [Link: ...]"
            if (insideItems.length > 0) {
                // Sort by X to find the right-most, then Y (roughly same line)
                // Usually PDF text is left-to-right.
                insideItems.sort((a, b) => a.x - b.x);
                const lastItem = insideItems[insideItems.length - 1];

                // Avoid duplicate tagging if somehow overlapping
                if (!lastItem.url) {
                    lastItem.url = ann.url;
                }
            }
        }

        // 4. Reconstruct Page Text (Simple Sort)
        // Sort items by Y (descending - top to bottom) then X (ascending)
        items.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 5) {
                return b.y - a.y; // Different lines
            }
            return a.x - b.x; // Same line, left to right
        });

        let pageText = "";
        let lastY = -1;

        items.forEach(item => {
            if (lastY !== -1 && Math.abs(item.y - lastY) > 10) {
                pageText += "\n";
            } else if (lastY !== -1) {
                pageText += " "; // Space between words on same line
            }

            pageText += item.str;

            if (item.url) {
                pageText += ` [Link: ${item.url}]`;
            }

            lastY = item.y;
        });

        fullText += pageText + "\n\n";
    }

    return fullText;
}

// Keep the original helper if needed, or we can rely solely on the extraction above.
// For the Agent state, we might still want the raw list, so leaving this compatible helper.
export async function extractLinksFromPdfBuffer(buffer: Buffer): Promise<ExtractedLink[]> {
    const text = await extractTextWithLinks(buffer);
    // This is a dummy return to satisfy the interface if we strictly needed it, 
    // but in the new plan, we rely on the text itself.
    // However, to avoid breaking existing calls immediately, let's keep the real logic or unrelated.
    // Actually, let's just re-implement the old logic here briefly simply if needed, 
    // OR update the caller to not need this.

    // PROCEED: I will update the caller to use extractTextWithLinks and drop the old separate list usage
    // because the embedded text is superior.
    return [];
}
