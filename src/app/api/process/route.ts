import { NextResponse } from 'next/server';
import { createResumeGraph, AgentState } from '@/lib/langgraph/graph';
import { supabase } from '@/lib/supabase/client';

import { extractLinksFromPdfBuffer, extractTextWithLinks } from '@/lib/pdf-utils';

export const maxDuration = 60; // Increase Vercel timeout to 60 seconds


export async function GET() {
    return NextResponse.json({ status: "alive", message: "API is ready" });
}

export async function POST(req: Request) {
    console.log("Processing POST request...");
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const jdText = formData.get('jd') as string;

        if (!file || !jdText) {
            return NextResponse.json({ success: false, error: "Missing resume file or JD text" }, { status: 400 });
        }

        // Parse PDF to Text with embedded links
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // This replaces the old PDFParse and the separate link extraction
        // resumeText will now contain "Project Name [Link: https://...]"
        const resumeText = await extractTextWithLinks(buffer);

        const graph = createResumeGraph();

        const initialState: AgentState = {
            rawResumeText: resumeText,
            rawJdText: jdText,
            detectedLinks: [], // No longer used separately
            resumeJson: null,
            initialAtsData: null,
            optimizedResumeJson: null,
            finalAtsData: null,
            rendercvYaml: '',
        };

        // Run the graph
        const result = (await graph.invoke(initialState)) as AgentState;

        // Store scores in Supabase
        if (result.initialAtsData && result.finalAtsData) {
            const { error: dbError } = await supabase.from('optimizations').insert({
                initial_score: result.initialAtsData.score,
                final_score: result.finalAtsData.score,
                candidate_name: result.resumeJson?.personal?.name || 'Unknown',
                missing_keywords: result.initialAtsData.missing_keywords,
                jd_text: jdText.substring(0, 500) // Store snippet
            });

            if (dbError) console.error("Supabase Error:", dbError);
        }

        return NextResponse.json({
            success: true,
            data: {
                initialScore: result.initialAtsData?.score || 0,
                finalScore: result.finalAtsData?.score || 0,
                resumeData: result.optimizedResumeJson || result.resumeJson,
                yaml: result.rendercvYaml,
                missingKeywords: result.initialAtsData?.missing_keywords || [],
                matchedKeywords: result.initialAtsData?.matched_keywords || [],
                improvements: [
                    result.initialAtsData?.missing_keywords?.length
                        ? `Integrated missing keywords: ${result.initialAtsData.missing_keywords.slice(0, 5).join(', ')}${result.initialAtsData.missing_keywords.length > 5 ? '...' : ''}`
                        : "Optimized keyword density based on JD",
                    "Rewrote experience highlights for better ATS impact",
                    "Optimized structure for RenderCV compatibility"
                ]
            }
        });

    } catch (error: unknown) {
        console.error("Agent Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
