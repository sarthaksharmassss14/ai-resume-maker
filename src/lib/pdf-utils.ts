// @ts-ignore
import pdf from 'pdf-parse';

export interface ExtractedLink {
    url: string;
    text: string;
    page: number;
    rect: number[];
}

/**
 * Extracts text AND embedded links from PDF using pdf-parse with a custom render callback.
 * This extracts hidden hyperlinks (annotations) and appends them to the text.
 */
export async function extractTextWithLinks(buffer: Buffer): Promise<string> {
    try {
        const options = {
            // Custom page render function to extract text AND annotations (links)
            pagerender: async function (pageData: any) {
                // 1. Get Text
                const textContent = await pageData.getTextContent();
                let pageText = textContent.items.map((item: any) => item.str).join(" ");

                // 2. Get Annotations (Links)
                const annotations = await pageData.getAnnotations();
                if (annotations && annotations.length > 0) {
                    const links = annotations
                        .filter((a: any) => a.subtype === 'Link' && a.url)
                        .map((a: any) => `[Link: ${a.url}]`);

                    if (links.length > 0) {
                        // Append links to the bottom of the page text
                        pageText += "\n\n--- Links on this page ---\n" + links.join("\n") + "\n------------------------\n";
                    }
                }

                return pageText;
            }
        };

        const data = await pdf(buffer, options);
        return data.text;
    } catch (error) {
        console.error("PDF Parse Error:", error);
        throw new Error("Failed to parse PDF file");
    }
}

// Deprecated but kept for interface compatibility
export async function extractLinksFromPdfBuffer(buffer: Buffer): Promise<ExtractedLink[]> {
    return [];
}
