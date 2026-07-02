import { NextResponse } from 'next/server';
import { 
    resumeParserNode, 
    atsScorerNode, 
    resumeOptimizerNode, 
    rendercvGeneratorNode 
} from '@/lib/langgraph/graph';
import { supabase } from '@/lib/supabase/client';
import { extractTextWithLinks } from '@/lib/pdf-utils';

export const maxDuration = 60; // Configured for Vercel

export async function GET() {
    return NextResponse.json({ status: "alive", message: "API is ready" });
}

export async function POST(req: Request) {
    console.log("Processing request...");
    try {
        const url = new URL(req.url);
        const mode = url.searchParams.get('mode') || 'parse';

        if (mode === 'parse') {
            const formData = await req.formData();
            const file = formData.get('file') as File;

            if (!file) {
                return NextResponse.json({ success: false, error: "Missing file" }, { status: 400 });
            }

            // Parse PDF
            const buffer = Buffer.from(await file.arrayBuffer());
            const resumeText = await extractTextWithLinks(buffer);

            const state: any = {
                rawResumeText: resumeText,
                rawJdText: '',
                detectedLinks: [],
                resumeJson: null,
                initialAtsData: null,
                optimizedResumeJson: null,
                finalAtsData: null,
                rendercvYaml: '',
            };

            const result = await resumeParserNode(state);

            return NextResponse.json({
                success: true,
                data: {
                    resumeData: result.resumeJson
                }
            });
        }

        else if (mode === 'score') {
            const body = await req.json();
            const { resumeJson, optimizedResumeJson, initialAtsData, jdText } = body;

            if (!resumeJson || !jdText) {
                return NextResponse.json({ success: false, error: "Missing input for scoring" }, { status: 400 });
            }

            const state: any = {
                rawResumeText: '',
                rawJdText: jdText,
                detectedLinks: [],
                resumeJson: resumeJson,
                initialAtsData: initialAtsData || null,
                optimizedResumeJson: optimizedResumeJson || null,
                finalAtsData: null,
                rendercvYaml: '',
            };

            const result = await atsScorerNode(state);
            const atsData = optimizedResumeJson ? result.finalAtsData : result.initialAtsData;

            return NextResponse.json({
                success: true,
                data: {
                    atsData
                }
            });
        }

        else if (mode === 'optimize') {
            const body = await req.json();
            const { resumeJson, initialAtsData, rawJdText } = body;

            if (!resumeJson || !initialAtsData || !rawJdText) {
                return NextResponse.json({ success: false, error: "Missing input for optimization" }, { status: 400 });
            }

            const state: any = {
                rawResumeText: '',
                rawJdText: rawJdText,
                detectedLinks: [],
                resumeJson: resumeJson,
                initialAtsData: initialAtsData,
                optimizedResumeJson: null,
                finalAtsData: null,
                rendercvYaml: '',
            };

            const result = await resumeOptimizerNode(state);

            return NextResponse.json({
                success: true,
                data: {
                    optimizedResumeJson: result.optimizedResumeJson
                }
            });
        }

        else if (mode === 'yaml') {
            const body = await req.json();
            const { optimizedResumeJson } = body;

            if (!optimizedResumeJson) {
                return NextResponse.json({ success: false, error: "Missing optimized resume JSON" }, { status: 400 });
            }

            const state: any = {
                rawResumeText: '',
                rawJdText: '',
                detectedLinks: [],
                resumeJson: null,
                initialAtsData: null,
                optimizedResumeJson: optimizedResumeJson,
                finalAtsData: null,
                rendercvYaml: '',
            };

            const result = await rendercvGeneratorNode(state);

            return NextResponse.json({
                success: true,
                data: {
                    yaml: result.rendercvYaml
                }
            });
        }

        else if (mode === 'store') {
            const body = await req.json();
            const { initialScore, finalScore, candidateName, missingKeywords, jdText } = body;

            const { error: dbError } = await supabase.from('optimizations').insert({
                initial_score: initialScore,
                final_score: finalScore,
                candidate_name: candidateName || 'Unknown',
                missing_keywords: missingKeywords || [],
                jd_text: (jdText || '').substring(0, 500)
            });

            if (dbError) {
                console.error("Supabase Error:", dbError);
                return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true });
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
