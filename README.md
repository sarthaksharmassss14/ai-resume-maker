# Agentic AI-Powered Resume Optimizer


![License](https://img.shields.io/badge/license-MIT-blue.svg)

**Agentic Resume** is a next-generation resume optimization tool powered by advanced AI agents. It goes beyond simple keyword matching by using a multi-agent orchestration system to deeply understand your resume and the job description (JD), rewriting your content to maximize ATS visibility and human readability.

## 🚀 Key Features

- **📄 Smart PDF Parsing**: Accurately extracts text, links, and structure from your existing resume.
- **🤖 Multi-Agent Optimization**: Uses specialized AI agents to analyze, score, and rewrite your resume.
- **🎯 Intelligent ATS Scoring**: Implements a Weighted Heuristic Match (WHM) algorithm to evaluate keyword depth, skill coverage, and experience relevance.
- **✍️ Context-Aware Rewriting**: Automatically enhances bullet points with impact metrics and stronger action verbs tailored to the JD.
- **📊 Real-time Feedback**: Streaming progress updates as the agents work on your resume.
- **🏗️ RenderCV Compatible**: Generates YAML output compatible with RenderCV for high-quality PDF generation.

## 🛠️ Technical Architecture

The core of the application relies on **LangGraph** to coordinate a Directed Acyclic Graph (DAG) of specialized agents:

| Agent | Role |
|-------|------|
| **ParserAgent** | Extracts entities and structure from raw PDF text. |
| **AnalyzerAgent** | Breaks down the Job Description into weighted skill clusters. |
| **ScorerAgent** | Calculates ATS scores based on keyword vectors, skill coverage, and experience relevance. |
| **OptimizerAgent** | Rewrites experience bullets to align with the JD's requirements. |
| **YAMLGenAgent** | Formats the final curated content into a structured YAML for PDF generation. |

### Scoring Logic (WHM)
Our ATS scorer evaluates resumes on four key dimensions:
1. **Keyword Vector Match (40%)**: Jaccard similarity with semantic understanding.
2. **Skill Coverage (30%)**: Matches against hard and soft skills.
3. **Experience Relevance (20%)**: Weighted by recency and role relevance.
4. **Quantification & Impact (10%)**: Checks for measurable metrics (%, $, numbers).

## 💻 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI Orchestration**: [LangGraph](https://langchain-ai.github.io/langgraphjs/) & [LangChain](https://js.langchain.com/)
- **LLM Provider**: [Groq](https://groq.com/) (Llama 3 models)
- **Database**: [Supabase](https://supabase.com/) (for storing optimization history)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/)
- **PDF Processing**: `pdf-parse`, `jspdf`

## 🏁 Getting Started

### Prerequisites
- Node.js 20+ installed.
- Supabase account and project.
- Groq API Key.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/resumemaker.git
   cd resumemaker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   # LLM Provider
   GROQ_API_KEY=your_groq_api_key_here

   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Optional: OpenAI (if used as fallback)
   OPENAI_API_KEY=your_openai_key
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

5. **Open the App**
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
