"use client";

import { useEffect, useState } from "react";
import { Results } from "@/components/dashboard/Results";
import { ResumeJSON } from "@/types/resume";

export default function EditPage() {
    const [resumeData, setResumeData] = useState<ResumeJSON | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('resume_edit_data');
        if (saved) {
            try {
                setResumeData(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse resume data", e);
            }
        }
    }, []);

    if (!resumeData) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-2xl font-bold mb-4">No data found to edit</h1>
                <p className="text-white/60 mb-8">Please go back to the dashboard and click "Fine-tune Resume" again.</p>
                <button
                    onClick={() => window.close()}
                    className="px-6 py-2 bg-white text-black rounded-lg font-bold"
                >
                    Close Tab
                </button>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#0a0a0a]">
            {/* We pass isStandalone=true so Results component opens the editor overlay immediately */}
            <Results
                resumeData={resumeData}
                isStandalone={true}
            />
        </main>
    );
}
