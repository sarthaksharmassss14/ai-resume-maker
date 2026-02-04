import pdf from 'pdf-parse';

export interface ExtractedLink {
    url: string;
    text: string;
    page: number;
    rect: number[];
}

/**
 * Extracts text from PDF using the robust pdf-parse library.
 * Note: pdf-parse is strictly for text extraction and is 
 * much more stable in serverless environments than pdfjs-dist.
 */
export async function extractTextWithLinks(buffer: Buffer): Promise<string> {
    try {
        const data = await pdf(buffer);
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
