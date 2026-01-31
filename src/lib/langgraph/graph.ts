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
        weak_sections: string[];
    } | null;
    optimizedResumeJson: ResumeJSON | null;
    finalAtsData: {
        score: number;
        missing_keywords: string[];
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
        weak_sections: string[];
    } | null>(),
    optimizedResumeJson: Annotation<ResumeJSON | null>(),
    finalAtsData: Annotation<{
        score: number;
        missing_keywords: string[];
        weak_sections: string[];
    } | null>(),
    rendercvYaml: Annotation<string>(),
});

// Initialize LLM (Groq)
// Initialize LLM (Groq)
const getModel = () => new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    temperature: 0,
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
- If something is unclear, omit it
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
    }
    return { resumeJson: JSON.parse(jsonStr) };
};

// --- STEP 3: ATS Scorer (Analysis only) ---
const atsScorerNode = async (state: typeof StateAnnotation.State) => {
    const currentResume = state.optimizedResumeJson || state.resumeJson;
    const model = getModel();

    const prompt = `Input: ResumeJSON + JD
Output ONLY JSON:
{
  "score": number, 
  "missing_keywords": ["string"],
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
    }

    const result = JSON.parse(jsonStr);

    return state.optimizedResumeJson ? { finalAtsData: result } : { initialAtsData: result };
};

// --- STEP 4: Resume Optimizer (JSON -> JSON) ---
const resumeOptimizerNode = async (state: typeof StateAnnotation.State) => {
    const model = getModel();
    const keywords = state.initialAtsData?.missing_keywords.join(", ") || "";

    const prompt = `Rewrite the ResumeJSON to improve ATS score based on these JD keywords: ${keywords}
Rules:
- Rewrite bullets with action verbs and metrics
- Add keywords ONLY if reasonable and truthfully possible based on existing experience
- Do not add new jobs or education
- **CRITICAL: If the 'summary' field is missing or empty, CREATE a powerful, 2-3 sentence professional summary based on the candidate's experience and skills.**
- Keep the same JSON schema
- CRITICAL: PRESERVE ALL URLs and Markdown links (e.g., [text](url)) inside bullets or text. Do not strip them.

Input ResumeJSON:
${JSON.stringify(state.resumeJson)}`;

    const response = await model.invoke(prompt);
    let optimizedStr = response.content.toString();
    const jsonMatch = optimizedStr.match(/```json\s*([\s\S]*?)\s*```/) || optimizedStr.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        optimizedStr = jsonMatch[1];
    }
    return { optimizedResumeJson: JSON.parse(optimizedStr) };
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
