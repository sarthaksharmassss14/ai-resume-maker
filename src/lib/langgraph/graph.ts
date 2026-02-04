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
const getModel = (temperature = 0) => new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    temperature,
});

// --- STEP 2: Resume Parser Agent ---
const resumeParserNode = async (state: typeof StateAnnotation.State) => {
    const model = getModel();
    // Links are now embedded in state.rawResumeText as [Link: url]

    const prompt = `You extract resume content into structured JSON.
Rules:
- Output ONLY valid JSON
- Follow the provided schema exactly
- Do not infer fake experience
- If something is unclear, omit it. Do NOT use placeholders like "University", "Company", or "Location" if the specific name is missing; instead, keep the raw text as is or omit the field.
- Preserve the exact names of Institutions (Colleges/Universities) and Companies as they appear in the text.
- The Resume Text contains embedded links in the format "[Link: URL]" right next to the text they belong to.
  - Example: "My Project [Link: https://github.com/me]" -> name: "My Project", link: "https://github.com/me"
  - Map these URLs to the 'link' or 'url' fields of the corresponding item.

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
    return { resumeJson: JSON.parse(jsonStr) };
};

// --- STEP 3: ATS Scorer (Analysis only) ---
const atsScorerNode = async (state: typeof StateAnnotation.State) => {
    const currentResume = state.optimizedResumeJson || state.resumeJson;
    const model = getModel(0); // Set to 0 for deterministic, consistent scoring

    const isFinalPass = !!state.optimizedResumeJson;
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
            console.error("ATS Scorer failed to generate JSON. Fallback to 0.");
            return state.optimizedResumeJson
                ? { finalAtsData: { score: 0, missing_keywords: [], weak_sections: [] } }
                : { initialAtsData: { score: 0, missing_keywords: [], weak_sections: [] } };
        }
    }

    try {
        const result = JSON.parse(jsonStr);
        return state.optimizedResumeJson ? { finalAtsData: result } : { initialAtsData: result };
    } catch (e) {
        console.error("ATS JSON parse error", e);
        const fallback = { score: 0, missing_keywords: [], matched_keywords: [], weak_sections: [] };
        return state.optimizedResumeJson
            ? { finalAtsData: fallback }
            : { initialAtsData: fallback };
    }
};

// --- STEP 4: Resume Optimizer (JSON -> JSON) ---
const resumeOptimizerNode = async (state: typeof StateAnnotation.State) => {
    if (!state.resumeJson) return { optimizedResumeJson: state.resumeJson };

    const model = getModel(0.1); // Lower temp for strict factual adherence
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
    const model = getModel();
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
export const createResumeGraph = () => {
    const workflow = new StateGraph(StateAnnotation)
        .addNode("resume_parser", resumeParserNode)
        .addNode("ats_scorer_before", atsScorerNode)
        .addNode("resume_optimizer", resumeOptimizerNode)
        .addNode("ats_scorer_after", atsScorerNode)
        .addNode("rendercv_generator", rendercvGeneratorNode);

    workflow.addEdge(START, "resume_parser");
    workflow.addEdge("resume_parser", "ats_scorer_before");
    workflow.addEdge("ats_scorer_before", "resume_optimizer");
    workflow.addEdge("resume_optimizer", "ats_scorer_after");
    workflow.addEdge("ats_scorer_after", "rendercv_generator");
    workflow.addEdge("rendercv_generator", END);

    return workflow.compile();
};
