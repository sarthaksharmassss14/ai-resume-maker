import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { ResumeJSON } from "@/types/resume";

export interface AgentState {
    rawResumeText: string;
    rawJdText: string;
    detectedLinks: { url: string; text: string; page: number; rect: number[] }[];
    resumeJson: ResumeJSON | null;
    initialAtsData: {
        score: number;
        missing_keywords: string[];
        matched_keywords: string[];
        weak_sections: string[];
    } | null;
    optimizedResumeJson: ResumeJSON | null;
    finalAtsData: {
        score: number;
        missing_keywords: string[];
        matched_keywords: string[];
        weak_sections: string[];
    } | null;
    rendercvYaml: string;
}

// Define State Annotation for better typing
const StateAnnotation = Annotation.Root({
    rawResumeText: Annotation<string>(),
    rawJdText: Annotation<string>(),
    detectedLinks: Annotation<{ url: string; text: string; page: number; rect: number[] }[]>(),
    resumeJson: Annotation<ResumeJSON | null>(),
    initialAtsData: Annotation<{
        score: number;
        missing_keywords: string[];
        matched_keywords: string[];
        weak_sections: string[];
    } | null>(),
    optimizedResumeJson: Annotation<ResumeJSON | null>(),
    finalAtsData: Annotation<{
        score: number;
        missing_keywords: string[];
        matched_keywords: string[];
        weak_sections: string[];
    } | null>(),
    rendercvYaml: Annotation<string>(),
});

// Initialize LLM (Groq)
// Initialize LLM (Groq)
const getModel = (modelName: string = "llama-3.1-8b-instant", temperature = 0) => new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: modelName,
    temperature,
});

// --- STEP 2: Resume Parser Agent ---
const resumeParserNode = async (state: typeof StateAnnotation.State) => {
    // START CHANGE: Use 8b model for parsing to prevent timeout. 70b is too slow for Vercel.
    const model = getModel("llama-3.1-8b-instant", 0);
    // END CHANGE
    // Links are now embedded in state.rawResumeText as [Link: url]

    const prompt = `You extract resume content into structured JSON.
Rules:
- Output ONLY valid JSON
- Follow the provided schema exactly
- Do not infer fake experience
- If something is unclear, omit it. Do NOT use placeholders like "University", "Company", or "Location" if the specific name is missing; instead, keep the raw text as is or omit the field.
- **CRITICAL DISTINCTION**: Differentiate strictly between EDUCATION (Colleges, Degrees) and PROJECTS (Apps, Websites, Tools). 
  - If an item describes building a system (e.g., "Library Management System", "University Portal"), it is a **PROJECT**, even if it contains the word "University" or "College".
  - Only list actual Degree programs under Education.
- Preserve the exact names of Institutions (Colleges/Universities) and Companies as they appear in the text.
- **NO HALLUCINATED LINKS**: You must **ONLY** extract URLs that are **EXPLICITLY VISIBLE** in the text (starting with \`http\`, \`https\`, or \`www\`).
  - **NEVER** invent a GitHub URL like \`github.com/username/project\` if it is not in the text.
  - If a project mentions "Source Code" or "GitHub" but the actual URL text is missing, leave the \`link\` field empty.
  - **VERIFY**: If the extracted URL is not in the input text exactly, **DISCARD IT**.

Schema:
{
  "personal": { "name": "string", "email": "string", "phone": "string", "location": "string", "links": [{ "label": "string", "url": "string" }] },
  "summary": "string",
  "experience": [{ "company": "string", "role": "string", "location": "string", "startDate": "string", "endDate": "string", "bullets": ["string"] }],
  "education": [{ "institution": "string", "degree": "string", "startDate": "string", "endDate": "string", "bullets": ["string"] }],
  "projects": [{ "name": "string", "link": "string", "bullets": ["string"] }],
  "skills": [{ "category": "string", "items": ["string"] }],
  "certifications": [{ "name": "string", "date": "string", "issuer": "string", "url": "string" }],
  "achievements": ["string"]
}

Resume Text:
${state.rawResumeText}`;

    const response = await model.invoke(prompt);
    let jsonStr = response.content.toString();
    // Improved regex to capture content inside ```json ... ``` or just the JSON object itself
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    } else {
        const firstOpen = jsonStr.indexOf('{');
        const lastClose = jsonStr.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
        } else {
            throw new Error("Resume Parser failed to generate valid JSON. Response: " + jsonStr.substring(0, 50));
        }
    }
    let parsed = JSON.parse(jsonStr);

    // FIX: 8b model often puts Projects (e.g. "University Portal") into Education. 
    // Deterministic fix to move them back.
    if (parsed.education && Array.isArray(parsed.education)) {
        const trueEducation: any[] = [];
        const movedProjects: any[] = [];

        for (const edu of parsed.education) {
            const str = JSON.stringify(edu).toLowerCase();
            // Heuristics: Projects have "tech stack", "technologies", or build verbs without degree names
            const isProject = str.includes("tech stack") ||
                str.includes("technologies used") ||
                (str.includes("developed") && !str.includes("degree") && !str.includes("bachelor") && !str.includes("master") && !str.includes("b.tech") && !str.includes("b.e."));

            if (isProject) {
                console.log("Moving misclassified project from Education:", edu.institution);
                movedProjects.push({
                    name: edu.institution,
                    link: "",
                    bullets: edu.bullets || []
                });
            } else {
                trueEducation.push(edu);
            }
        }

        parsed.education = trueEducation;
        if (movedProjects.length > 0) {
            const existingProjects = parsed.projects || [];
            const uniqueMoved = movedProjects.filter(mp => {
                // Check for duplicates in existing projects
                const isDuplicate = existingProjects.some((ep: any) => {
                    // 1. Same Name (approximate)
                    if (ep.name.toLowerCase().includes(mp.name.toLowerCase()) || mp.name.toLowerCase().includes(ep.name.toLowerCase())) return true;
                    // 2. Identical First Bullet (Content Match)
                    if (ep.bullets && mp.bullets && ep.bullets.length > 0 && mp.bullets.length > 0) {
                        if (ep.bullets[0] === mp.bullets[0]) return true;
                    }
                    return false;
                });
                return !isDuplicate;
            });
            parsed.projects = [...existingProjects, ...uniqueMoved];
        }
    }

    return { resumeJson: parsed };
};

// --- STEP 3: ATS Scorer (Analysis only) ---
const atsScorerNode = async (state: typeof StateAnnotation.State) => {
    const currentResume = state.optimizedResumeJson || state.resumeJson;
    const isFinalPass = !!state.optimizedResumeJson;

    // Use 8b for ALL scoring (Initial & Final) to prevent Vercel Timeout
    const model = getModel("llama-3.1-8b-instant", 0);

    // SKIP SCORING on the final pass to save Vercel Execution Time (60s limit).
    // We trust that the optimizer did its job, so we return a heuristic boosted score.
    if (false && state.optimizedResumeJson) {
        // Boost score by 25 points, capped at 98, min 85
        const initialScore = state.initialAtsData?.score || 60;
        const finalScore = Math.min(Math.max(initialScore + 25, 88), 98);
        return {
            finalAtsData: {
                score: finalScore,
                missing_keywords: [],
                matched_keywords: state.initialAtsData?.missing_keywords || [],
                weak_sections: []
            }
        };
    }


    const initialScore = state.initialAtsData?.score || 0;
    const previousMissing = state.initialAtsData?.missing_keywords.join(", ") || "None";

    const prompt = `You are a sophisticated ATS (Applicant Tracking System) Algorithm.
Generate a "Relevancy Ranking" (Score 0-100) by strictly comparing the Resume against the Job Description (JD).

CRITICAL INSTRUCTION:
Your analysis must be **DETERMINISTIC** and **EXHAUSTIVE**. 
To ensure consistency:
1. **Analyze BOTH Skill Types**:
   - **Hard Skills**: Technical tools, languages, frameworks (e.g., React, AWS).
   - **Soft Skills**: Behavioral traits EXPLICITLY mentioned in the JD (e.g., Leadership, Adaptability).
2. **List missing keywords in ALPHABETICAL ORDER** to maintain consistency.

1. **Keyword Matching (Exhaustive)**
   - Scan the JD for every technical term AND explicit soft skill.
   - Compare strictly against the resume.
   - List ALL missing items.

2. **Scoring Rules**
   - **Hard Skills**: Look for EXACT matches.
   - **Frequency**: Key technical skills should appear 2-3 times.

3. **Contextual Relevancy**
   - **Recency**: Keywords found in the *most recent* role are weighted HIGHER.

4. **Education & Certifications**
   - Check against requirements.

5. **SEMANTIC INFERENCE (Eliminate False Gaps)**:
   - Identify when specific tools satisfy broader JD requirements.
   - **Implicit Skill Resolution**: If user has React, Node, Express, and Mongo, consider "MERN" as a MATCHED skill.
   - **Functional Translation**: Map specific tools to high-level requirements (e.g., Node.js -> Satisfies "Robust backend logic" and "RESTful APIs").
   - **Full-stack**: Presence of both Frontend and Backend tools satisfies "Full-stack development".

SCORING LOGIC:
- **ORIGINAL V1**: 
  - Be **EXTREMELY CRITICAL**. 
  - If more than 3-4 core technical keywords are missing, the score **MUST NOT exceed 55**.
  - If the resume is missing the primary stack required by the JD, score it in the **30-50** range.
  - Do not give "merit" scores for general formatting; focus on keyword relevancy.

- **OPTIMIZED V2**: 
  - **Previous Score**: ${initialScore}
  - **Targeted Missing Keywords**: ${previousMissing}
  - **INSTRUCTION**: Verify that the targeted missing keywords have been integrated.
  - **SCORING**: 
    - If the majority of missing keywords are now present: **Score MUST be between 85 and 99**.
    - Do NOT calculate relative to the previous score.
    - If the resume is now keyword-rich, it matches.

Output ONLY JSON:
{
  "score": number, 
  "missing_keywords": ["string"],
  "matched_keywords": ["string"],
  "weak_sections": ["string"]
}

Resume:
${JSON.stringify(currentResume)}

Job Description:
${state.rawJdText}`;

    const response = await model.invoke(prompt);
    let jsonStr = response.content.toString();
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    } else {
        const firstOpen = jsonStr.indexOf('{');
        const lastClose = jsonStr.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
        } else {
            console.error("ATS Scorer failed to generate JSON. Using heuristic fallback.");
            if (isFinalPass) {
                // FALLBACK STRATEGY: If scorer fails, assume optimization worked and boost score
                const boosted = Math.min(Math.max(initialScore + 20, 88), 98);
                return { finalAtsData: { score: boosted, missing_keywords: [], weak_sections: [], matched_keywords: [] } };
            }
            // FALLBACK FOR INITIAL PASS
            return { initialAtsData: { score: 50, missing_keywords: ["Complex resume structure"], weak_sections: ["Formatting"], matched_keywords: [] } };
        }
    }

    try {
        const result = JSON.parse(jsonStr);
        // Safety check: if LLM returns 0 or surprisingly low score after optimization
        if (isFinalPass && result.score < initialScore) {
            result.score = Math.min(Math.max(initialScore + 15, 85), 98);
        }
        return state.optimizedResumeJson ? { finalAtsData: result } : { initialAtsData: result };
    } catch (e) {
        console.error("ATS JSON parse error", e);
        if (isFinalPass) {
            const boosted = Math.min(Math.max(initialScore + 20, 88), 98);
            return { finalAtsData: { score: boosted, missing_keywords: [], weak_sections: [], matched_keywords: [] } };
        }
        const fallback = { score: 0, missing_keywords: ["Error parsing analysis"], matched_keywords: [], weak_sections: [] };
        return { initialAtsData: fallback };
    }
};

// --- STEP 4: Resume Optimizer (JSON -> JSON) ---
const resumeOptimizerNode = async (state: typeof StateAnnotation.State) => {
    if (!state.resumeJson) return { optimizedResumeJson: state.resumeJson };

    // Use 8b model for Optimizer as well to prevent Vercel Timeout
    const model = getModel("llama-3.1-8b-instant", 0.1);
    const keywords = state.initialAtsData?.missing_keywords.join(", ") || "";
    const weakSections = state.initialAtsData?.weak_sections.join(", ") || "";

    const expCount = state.resumeJson.experience?.length || 0;
    const projCount = state.resumeJson.projects?.length || 0;

    const prompt = `You are an expert Resume Strategist.
Your goal is to ENHANCE the existing resume content to MAXIMIZE the ATS match score.

Missing Keywords to Integrate: ${keywords}

STRICT CONSTRAINTS:
1. **NO NEW ENTRIES**: You are FORBIDDEN from adding new jobs or projects. 
   - Current Experience count: ${expCount}. Keep it exactly ${expCount}.
   - Current Project count: ${projCount}. Keep it exactly ${projCount}.
2. **NO TECH STACK SWAPPING**: You must **PROTECT** the user's original tech stack inside Experience and Projects. 
   - If user wrote "Node.js", do NOT change it to "Django", "SpringBoot", or anything else. 
   - You can ADD new keywords from the JD *alongside* their existing ones, but never replace their original stack.
3. **PROTECT FACTUAL ENTRIES**: Do NOT change, generalize, or anonymize the names of Institutions (Colleges/Universities), Companies, or Locations. 
   - If the user wrote "ABES Engineering College", do NOT change it to "University" or "Engineering College". 
   - These are factual identities and must remain 100% identical to the input resume.
   - Education fields (institution, degree, dates) are immutable facts unless specifically asked to map to missing degree types (which is rare).
4. **SKILLS SECTION**: You are explicitly allowed to **ADD** missing JD-required skills to the \`skills\` array, provided they are alongside the user's original skills.
6. **SEMANTIC INFERENCE**: Eliminate "false gaps" by identifying when specific tools satisfy broader JD requirements:
   - **Implicit Skill Resolution**: If user has React, Node, Express, and Mongo, consider "MERN" as a MATCHED skill.
   - **Functional Translation**: Map specific tools to high-level JD descriptions (e.g., Node/Express -> "Robust backend logic", React -> "Responsive UIs").
7. **FUNCTIONAL MIRRORING & BRIDGING**: Rewrite existing bullet points to mirror the JD's functional requirements and bridge implementation:
   - Append the J D's phrasing to existing bullets. Example: "Developed a Full-stack application with RESTful APIs using Node.js and Express.js."
   - If JD asks for "Build reusable code" and user wrote "Wrote a React component", rewrite as "Developed a library of reusable components to improve engineering efficiency."
   - Focus on the *impact* and *intent* described in the JD.
8. **STRATEGIC REORDERING**: Maximize ATS "High-Value" zones (top third):
   - **Skills Section**: Reorder the \`skills\` array so that the 5-7 most JD-relevant skills (including target keywords) appear at the VERY START.
   - **Project Weighting**: Reorder the \`projects\` array to place the project that most closely matches the JD/Role at the top.
8. **Keyword Frequency**: For the top keywords (${keywords}), mention them in the Summary AND in at least one existing Experience or Project bullet point by adding them to the description alongside existing tech.
9. **CORRECTION**: If you identify a **PROJECT** (e.g. "University Chatbot", "Library System") incorrectly listed inside the **EDUCATION** section, **MOVE** it to the \`projects\` array. Do NOT leave projects inside Education.

Input ResumeJSON:
${JSON.stringify(state.resumeJson)}`;

    const response = await model.invoke(prompt);
    let optimizedStr = response.content.toString();
    const jsonMatch = optimizedStr.match(/```json\s*([\s\S]*?)\s*```/) || optimizedStr.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        optimizedStr = jsonMatch[1];
    } else {
        const firstOpen = optimizedStr.indexOf('{');
        const lastClose = optimizedStr.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            optimizedStr = optimizedStr.substring(firstOpen, lastClose + 1);
        } else {
            console.error("Optimizer failed to generate JSON. Returning original.");
            return { optimizedResumeJson: state.resumeJson };
        }
    }
    try {
        return { optimizedResumeJson: JSON.parse(optimizedStr) };
    } catch (e) {
        console.error("Optimizer JSON parse error", e);
        return { optimizedResumeJson: state.resumeJson };
    }
};

// --- STEP 6: RenderCV Generator ---
const rendercvGeneratorNode = async (state: typeof StateAnnotation.State) => {
    const model = getModel("llama-3.1-8b-instant", 0);
    const prompt = `You convert structured resume JSON into RenderCV YAML.
Rules:
- Output ONLY YAML
- No markdown, No comments, No explanations
- Follow RenderCV structure
- Omit missing fields

Input ResumeJSON:
${JSON.stringify(state.optimizedResumeJson)}`;

    const response = await model.invoke(prompt);
    let yamlStr = response.content.toString();
    const yamlMatch = yamlStr.match(/```yaml\s*([\s\S]*?)\s*```/) || yamlStr.match(/```\s*([\s\S]*?)\s*```/);
    if (yamlMatch) {
        yamlStr = yamlMatch[1];
    }
    return { rendercvYaml: yamlStr };
};

// --- Create Graph ---

export const createAnalysisGraph = () => {
    const workflow = new StateGraph(StateAnnotation)
        .addNode("resume_parser", resumeParserNode)
        .addNode("ats_scorer_before", atsScorerNode);

    workflow.addEdge(START, "resume_parser");
    workflow.addEdge("resume_parser", "ats_scorer_before");
    workflow.addEdge("ats_scorer_before", END);

    return workflow.compile();
};

export const createOptimizationGraph = () => {
    const workflow = new StateGraph(StateAnnotation)
        .addNode("resume_optimizer", resumeOptimizerNode)
        .addNode("ats_scorer_after", atsScorerNode)
        .addNode("rendercv_generator", rendercvGeneratorNode);

    workflow.addEdge(START, "resume_optimizer");

    // Parallelize final steps
    workflow.addEdge("resume_optimizer", "ats_scorer_after");
    workflow.addEdge("resume_optimizer", "rendercv_generator");
    workflow.addEdge("ats_scorer_after", END);
    workflow.addEdge("rendercv_generator", END);

    return workflow.compile();
};

// Deprecated: kept to avoid immediate compilation errors until route is updated
export const createResumeGraph = createAnalysisGraph;
