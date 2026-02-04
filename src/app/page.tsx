"use client";

import { useState } from "react";
import { Scanner } from "@/components/scanner/Scanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Briefcase, CheckCircle2, Search, Brain, FileOutput, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { Results } from "@/components/dashboard/Results";
import { ResumeJSON } from "@/types/resume";

const STAGES = [
  { id: "parsing", label: "Parsing Resume", icon: Upload },
  { id: "analyzing", label: "Initial Scoring", icon: Search },
  { id: "scoring_1", label: "Initial Validation", icon: Brain },
  { id: "optimizing", label: "Agentic Optimization", icon: Briefcase },
  { id: "scoring_2", label: "Final Validation", icon: CheckCircle2 },
  { id: "yaml", label: "Generating RenderCV", icon: FileOutput },
];

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState("");
  const [resultsData, setResultsData] = useState<{
    initialScore: number;
    finalScore: number;
    resumeData: ResumeJSON;
    improvements: string[];
    yaml?: string;
    missingKeywords?: string[];
    matchedKeywords?: string[];
  } | null>(null);

  const startProcessing = async () => {
    if (!resumeFile || !jdText) {
      alert("Please upload a resume and provide a job description.");
      return;
    }

    setIsProcessing(true);
    setShowResults(false);
    setCurrentStageIndex(0);
    setProgress(0);

    // Start UI Progress Simulation
    let stage = 0;
    const progressInterval = setInterval(() => {
      if (stage < STAGES.length - 1) {
        stage++;
        setCurrentStageIndex(stage);
        setProgress((stage / STAGES.length) * 100);
      }
    }, 3000);

    try {
      // Step 1: Analyze (Parse + Initial Score)
      const formData = new FormData();
      formData.append('file', resumeFile);
      formData.append('jd', jdText);

      const analyzeResponse = await fetch('/api/process?mode=analyze', {
        method: 'POST',
        body: formData,
      });

      let analyzeResult;
      const analyzeText = await analyzeResponse.text();
      try {
        analyzeResult = JSON.parse(analyzeText);
      } catch (e) {
        throw new Error(`Analysis failed: ${analyzeText.slice(0, 100)}...`);
      }

      if (!analyzeResult.success) {
        throw new Error(analyzeResult.error || "Analysis failed");
      }

      // Update progress for Step 2
      setCurrentStageIndex(2); // Move to "Initial Validation" / "Optimization"

      // Step 2: Optimize (Optimizer + Final Score)
      const optimizeResponse = await fetch('/api/process?mode=optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeJson: analyzeResult.data.resumeData,
          initialAtsData: {
            score: analyzeResult.data.initialScore,
            missing_keywords: analyzeResult.data.missingKeywords,
            matched_keywords: analyzeResult.data.matchedKeywords,
            weak_sections: []
          },
          rawJdText: jdText
        }),
      });

      let optimizeResult;
      const optimizeText = await optimizeResponse.text();
      try {
        optimizeResult = JSON.parse(optimizeText);
      } catch (e) {
        throw new Error(`Optimization failed: ${optimizeText.slice(0, 100)}...`);
      }

      if (optimizeResult.success) {
        clearInterval(progressInterval);
        setProgress(100);
        setCurrentStageIndex(STAGES.length - 1);

        setResultsData(optimizeResult.data); // Use final data

        setTimeout(() => {
          setIsProcessing(false);
          setShowResults(true);
        }, 1000);
      } else {
        throw new Error(optimizeResult.error || "Optimization failed");
      }
    } catch (error: unknown) {
      clearInterval(progressInterval);
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      alert(errorMessage);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

        {/* Left Side: Controls & Info */}
        <div className="space-y-8">
          <div className="space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-6xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-white/40"
            >
              AGENTIC<br />RESUME.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-white/50 max-w-md"
            >
              Ultra-fast AI optimization powered by Groq and LangGraph.
              Get your resume ATS-ready in seconds.
            </motion.p>
          </div>

          <div className="space-y-4">
            <Card className="p-6 glass border-white/5 space-y-4">
              <div className="flex items-center gap-4 text-white/80">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold">Resume PDF</h3>
                  <p className="text-sm text-white/40">
                    {resumeFile ? resumeFile.name : "Upload your existing resume"}
                  </p>
                </div>
              </div>
              <input
                type="file"
                className="hidden"
                id="resume-upload"
                accept=".pdf"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              />
              <label
                htmlFor="resume-upload"
                className={cn(
                  "block w-full text-center py-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer group",
                  resumeFile ? "border-primary/50 bg-primary/5" : "border-white/10 hover:border-primary/50"
                )}
              >
                <span className={cn(
                  "text-sm font-medium",
                  resumeFile ? "text-primary" : "text-white/40 group-hover:text-white"
                )}>
                  {resumeFile ? "Change File" : "Select PDF"}
                </span>
              </label>
            </Card>

            <Card className="p-6 glass border-white/5 space-y-4 relative z-20">
              <div className="flex items-center gap-4 text-white/80">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold">Job Description</h3>
                  <p className="text-sm text-white/40">Paste the JD text or target role</p>
                </div>
              </div>
              <textarea
                className="w-full h-32 bg-white/10 rounded-xl border border-white/20 p-4 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none text-white cursor-text caret-primary"
                placeholder="Paste JD here..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
            </Card>

            <Button
              onClick={startProcessing}
              disabled={isProcessing || !resumeFile || !jdText}
              className={cn(
                "w-full h-16 rounded-2xl text-lg font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98]",
                (resumeFile && jdText) ? "bg-primary hover:bg-primary/80" : "bg-white/5 border border-white/10 text-white/20 cursor-not-allowed"
              )}
            >
              {isProcessing ? "Optimizing with Agents..." : "Run Agentic Optimization"}
              {!isProcessing && <ArrowRight className="ml-2 w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Right Side: Visualizer or Results */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {!isProcessing && !showResults ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="relative"
              >
                <Scanner isScanning={false} progress={0} statusText="Ready for Scan" />
              </motion.div>
            ) : isProcessing ? (
              <motion.div
                key="active"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-8"
              >
                <Scanner
                  isScanning={true}
                  progress={progress}
                  statusText={STAGES[currentStageIndex]?.label || "Processing"}
                  icon={STAGES[currentStageIndex]?.icon}
                />

                <div className="grid grid-cols-2 gap-4">
                  {STAGES.map((stage, i) => (
                    <div
                      key={stage.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all duration-500",
                        i < currentStageIndex ? "bg-primary/20 border-primary/50 text-white" :
                          i === currentStageIndex ? "bg-white/5 border-white/20 text-white animate-pulse" :
                            "bg-transparent border-transparent text-white/20"
                      )}
                    >
                      <stage.icon className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-widest">{stage.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              resultsData && (
                <Results
                  initialScore={resultsData.initialScore}
                  finalScore={resultsData.finalScore}
                  resumeData={resultsData.resumeData}
                  improvements={resultsData.improvements}
                  missingKeywords={resultsData.missingKeywords}
                  matchedKeywords={resultsData.matchedKeywords}
                />
              )
            )}
          </AnimatePresence>
        </div>

      </div>
    </main>
  );
}
