import { NextResponse } from 'next/server';
import { createAnalysisGraph, createOptimizationGraph, AgentState } from '@/lib/langgraph/graph';
import { supabase } from '@/lib/supabase/client';

import { extractLinksFromPdfBuffer, extractTextWithLinks } from '@/lib/pdf-utils';

export const maxDuration = 60; // Increase Vercel timeout to 60 seconds




export async function GET() {
    return NextResponse.json({ status: "alive", message: "API is ready" });
}


export async function POST(req: Request) {
    console.log("Processing request...");
    try {
        const url = new URL(req.url);
        const mode = url.searchParams.get('mode') || 'analyze'; // 'analyze' or 'optimize'

        if (mode === 'analyze') {
            const formData = await req.formData();
            const file = formData.get('file') as File;
            const jdText = formData.get('jd') as string;

            if (!file || !jdText) {
                return NextResponse.json({ success: false, error: "Missing file or JD" }, { status: 400 });
            }

            // Parse PDF
            const buffer = Buffer.from(await file.arrayBuffer());
            const resumeText = await extractTextWithLinks(buffer);

            const graph = createAnalysisGraph();
            const initialState: AgentState = {
                rawResumeText: resumeText,
                rawJdText: jdText,
                detectedLinks: [],
                resumeJson: null,
                initialAtsData: null,
                optimizedResumeJson: null,
                finalAtsData: null,
                rendercvYaml: '',
            };

            const result = (await graph.invoke(initialState)) as AgentState;

            return NextResponse.json({
                success: true,
                data: {
                    initialScore: result.initialAtsData?.score || 0,
                    resumeData: result.resumeJson,
                    missingKeywords: result.initialAtsData?.missing_keywords || [],
                    rawJdText: jdText, // Return to client for next step
                    matchedKeywords: result.initialAtsData?.matched_keywords || [],
                }
            });
        }

        else if (mode === 'optimize') {
            const body = await req.json();
            const { resumeJson, initialAtsData, rawJdText } = body;

            if (!resumeJson || !initialAtsData || !rawJdText) {
                return NextResponse.json({ success: false, error: "Missing input for optimization" }, { status: 400 });
            }

            const graph = createOptimizationGraph();
            const initialState: AgentState = {
                rawResumeText: '',
                rawJdText: rawJdText,
                detectedLinks: [],
                resumeJson: resumeJson,
                initialAtsData: initialAtsData,
                optimizedResumeJson: null,
                finalAtsData: null,
                rendercvYaml: '',
            };

            const result = (await graph.invoke(initialState)) as AgentState;

            // Store scores in Supabase (moved here from original POST)
            if (result.initialAtsData && result.finalAtsData) {
                const { error: dbError } = await supabase.from('optimizations').insert({
                    initial_score: result.initialAtsData.score,
                    final_score: result.finalAtsData.score,
                    candidate_name: result.resumeJson?.personal?.name || 'Unknown',
                    missing_keywords: result.initialAtsData.missing_keywords,
                    jd_text: rawJdText.substring(0, 500) // Store snippet
                });

                if (dbError) console.error("Supabase Error:", dbError);
            }

            return NextResponse.json({
                success: true,
                data: {
                    finalScore: result.finalAtsData?.score || 0,
                    resumeData: result.optimizedResumeJson,
                    yaml: result.rendercvYaml,
                    initialScore: initialAtsData.score,
                    missingKeywords: initialAtsData.missing_keywords,
                    matchedKeywords: initialAtsData.matched_keywords,
                    improvements: [
                        "Optimized keyword density",
                        "Rewrote bullets for impact",
                        "Formatted for RenderCV"
                    ]
                }
            });
        }

        return NextResponse.json({ success: false, error: "Invalid mode" }, { status: 400 });

    } catch (error: unknown) {
        console.error("API Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
