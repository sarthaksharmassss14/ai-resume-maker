# Agentic AI Resume Editor - Technical Architecture & ATS Logic

## 1. Multi-Agent Orchestration (LangGraph)
The system uses a directed acyclic graph (DAG) to manage state and coordination between specialized agents.

| Agent | Responsibility | Model (Recommended) |
|-------|----------------|---------------------|
| **ParserAgent** | Extracts entities from raw PDF text into JSON. | Groq (Llama 3 70B) |
| **AnalyzerAgent** | Breaks down JD into weighted skill clusters. | Groq (Mixtral 8x7B) |
| **ScorerAgent** | Implements the Weighted Heuristic Match (WHM). | Groq (Llama 3 8B) |
| **OptimizerAgent** | Performs context-aware bullet rewriting. | Groq (Llama 3 70B) |
| **YAMLGenAgent** | Maps JSON to RenderCV YAML schema. | Groq (Llama 3 8B) |

## 2. ATS Scoring Logic: Weighted Heuristic Match (WHM)
Our scoring algorithm doesn't just look for keywords; it evaluates the *depth* and *context* of experience.

### Score Breakdown (0-100)
1. **Keyword Vector Match (40 pts)**:
   - Uses a custom stop-word filtered Jaccard similarity.
   - We extract "Entity Bi-grams" (e.g., "Full Stack", "Machine Learning") to avoid false positives.
   
2. **Skill Coverage (30 pts)**:
   - **Hard Skills (20 pts)**: Direct matches on technical requirements.
   - **Soft Skills (10 pts)**: Evaluates leadership, communication, and management keywords.

3. **Experience Relevance (20 pts)**:
   - Calculated by: `Σ (Years in Role X * Relevance of Role X to JD)`.
   - Penalizes roles older than 10 years for fast-moving tech stacks.

4. **Quantification & Impact (10 pts)**:
   - A heuristic that counts "Metric Tokens" (%, $, numbers, "reduced", "increased").
   - Resumes with >3 quantified highlights per role receive full points.

## 3. Production Deployment Notes
- **Streaming**: Implementation uses Server Sent Events (SSE) to update the frontend progress bar in real-time.
- **Fail-safe**: If an agent fails, the state remains intact, allowing the graph to retry from the last checkpoint using LangGraph's persistence.
- **Storage**: All versions (Original JSON, Optimized JSON, YAML) are stored in Supabase with RLS policies for user privacy.
