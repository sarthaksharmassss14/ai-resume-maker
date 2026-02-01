"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, TrendingUp, Edit3, X, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResumeJSON } from "@/types/resume";

interface ResultsProps {
    initialScore?: number;
    finalScore?: number;
    improvements?: string[];
    resumeData: ResumeJSON;
    yaml?: string;
    missingKeywords?: string[];
    matchedKeywords?: string[];
    isStandalone?: boolean;
}

export function Results({
    initialScore = 0,
    finalScore = 0,
    improvements = [],
    resumeData: initialResumeData,
    missingKeywords = [],
    matchedKeywords = [],
    isStandalone = false
}: ResultsProps) {
    // Inject global styles to hide scrollbars in the editor
    const scrollbarHideStyles = `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        textarea.hide-scrollbar { overflow: hidden !important; resize: none !important; }
    `;

    const [isEditing, setIsEditing] = useState(isStandalone);
    const [resumeData, setResumeData] = useState<ResumeJSON>(initialResumeData);
    const [tempJson, setTempJson] = useState("");

    const handleFineTune = () => {
        localStorage.setItem('resume_edit_data', JSON.stringify(resumeData));
        window.open('/edit', '_blank');
    };

    useEffect(() => {
        setResumeData(initialResumeData);
    }, [initialResumeData]);

    // Normalize scores to 0-100 scale
    const normalize = (s: number) => (s <= 1 ? Math.round(s * 100) : Math.round(s));

    const iScore = normalize(initialScore);
    const fScore = normalize(finalScore);
    const scoreIncrease = fScore - iScore;

    const handleSaveEdit = () => {
        setIsEditing(false);
    };

    const updatePersonal = (field: string, value: any) => {
        setResumeData(prev => ({
            ...prev,
            personal: { ...prev.personal, [field]: value }
        }));
    };

    const updateExperience = (index: number, field: string, value: any) => {
        setResumeData(prev => {
            const newExp = [...prev.experience];
            newExp[index] = { ...newExp[index], [field]: value };
            return { ...prev, experience: newExp };
        });
    };

    const updateEducation = (index: number, field: string, value: any) => {
        setResumeData(prev => {
            const newEdu = [...prev.education];
            newEdu[index] = { ...newEdu[index], [field]: value };
            return { ...prev, education: newEdu };
        });
    };

    const updateProject = (index: number, field: string, value: any) => {
        setResumeData(prev => {
            const newProj = [...(prev.projects || [])];
            newProj[index] = { ...newProj[index], [field]: value };
            return { ...prev, projects: newProj };
        });
    };

    const updateCertification = (index: number, field: string, value: any) => {
        setResumeData(prev => {
            const newCerts = [...(prev.certifications || [])];
            newCerts[index] = { ...newCerts[index], [field]: value };
            return { ...prev, certifications: newCerts };
        });
    };

    const updateAchievement = (index: number, value: string) => {
        setResumeData(prev => {
            const newAch = [...(prev.achievements || [])];
            newAch[index] = value;
            return { ...prev, achievements: newAch };
        });
    };

    const updateSkill = (catIndex: number, itemIndex: number, value: string) => {
        setResumeData(prev => {
            const newSkills = [...prev.skills];
            newSkills[catIndex].items[itemIndex] = value;
            return { ...prev, skills: newSkills };
        });
    };

    const downloadPdf = async () => {
        if (!resumeData || !resumeData.personal) {
            alert("Resume data is missing. Please try again.");
            return;
        }

        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "pt",
            format: "letter"
        });

        const margin = 56.7; // 2cm
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - (2 * margin);
        const marginBottom = 60;
        let y = 60;

        const checkPageBreak = (heightNeeded: number) => {
            if (y + heightNeeded > pageHeight - marginBottom) {
                doc.addPage();
                y = 60;
                return true;
            }
            return false;
        };

        const drawLinkIcon = (x: number, y: number) => {
            doc.setDrawColor(0, 0, 238); // Blue
            doc.setLineWidth(1);
            // ↗ shape: Diagonal
            doc.line(x, y, x + 6, y - 6);
            // Arrowhead
            doc.line(x + 6, y - 6, x + 2, y - 6); // Top horizontal part
            doc.line(x + 6, y - 6, x + 6, y - 2); // Right vertical part
            return 8; // return width
        };

        // Helper to draw text with optional link
        const drawTextWithLink = (text: string, x: number, y: number, options?: any, linkUrl?: string) => {
            doc.setTextColor(0, 0, 0); // Always black

            doc.text(text, x, y, options);

            if (linkUrl) {
                const textWidth = doc.getTextWidth(text);
                // Calculate alignment offset if centered/right
                let xPos = x;
                if (options?.align === 'center') xPos = x - (textWidth / 2);
                if (options?.align === 'right') xPos = x - textWidth;

                const safeUrl = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;

                // Underline
                doc.setLineWidth(0.5);
                doc.line(xPos, y + 1.5, xPos + textWidth, y + 1.5);

                doc.link(xPos, y - 10, textWidth, 12, { url: safeUrl });
            }
        };

        // 1. Header - Large Centered Name
        doc.setFont("times", "bold");
        doc.setFontSize(24);
        const name = resumeData.personal.name || "CANDIDATE";
        doc.text(name, pageWidth / 2, y, { align: "center" });
        y += 24;

        // 2. Contact Information Row (Centering calculation)
        doc.setFont("times", "normal");
        doc.setFontSize(10);

        const contactItems: { text: string; url?: string }[] = [];
        if (resumeData.personal.location) contactItems.push({ text: resumeData.personal.location });
        if (resumeData.personal.email) contactItems.push({ text: resumeData.personal.email, url: `mailto:${resumeData.personal.email}` });
        if (resumeData.personal.phone) contactItems.push({ text: resumeData.personal.phone, url: `tel:${resumeData.personal.phone}` });
        if (resumeData.personal.links) {
            resumeData.personal.links
                .filter(l => l.label.toLowerCase() !== 'email')
                .forEach(l => contactItems.push({ text: l.label || l.url, url: l.url }));
        }

        // Calculate total width to center the block
        const separator = "  |  ";
        const separatorWidth = doc.getTextWidth(separator);
        let totalWidth = 0;
        contactItems.forEach((item, index) => {
            totalWidth += doc.getTextWidth(item.text);
            if (index < contactItems.length - 1) totalWidth += separatorWidth;
        });

        let currentX = (pageWidth - totalWidth) / 2;

        contactItems.forEach((item, index) => {
            // Pass true to skip blue color and arrow in the header
            drawTextWithLink(item.text, currentX, y, {}, item.url);
            currentX += doc.getTextWidth(item.text);
            if (index < contactItems.length - 1) {
                doc.text(separator, currentX, y);
                currentX += separatorWidth;
            }
        });
        y += 24;

        const drawSectionHeader = (title: string) => {
            checkPageBreak(40);
            y += 6;
            doc.setFont("times", "bold");
            doc.setFontSize(12);
            doc.text(title, margin, y);
            y += 4;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.5);
            doc.line(margin, y, margin + contentWidth, y);
            y += 14;
        };

        // Helper to render text that might contain markdown links [Label](url) or raw URLs
        const renderRichText = (text: string, x: number, initialY: number, maxWidth: number, hangingIndent: number = 0) => {
            // Regex to capture [Label](url) OR raw match of http/https
            // Note: The simple regex might mismatch nested parenthesis, but sufficient for simple resume links.
            const regex = /(\[.*?\]\(.*?\))|(\bhttps?:\/\/[^\s]+)/g;
            const parts = text.split(regex).filter(p => p);

            let cursorX = x;
            let cursorY = initialY;
            const lineHeight = 13;

            // We need to reconstruct the stream of segments: string | {text, url}
            interface Segment { text: string; url?: string; isLink: boolean }
            const segments: Segment[] = [];

            // Re-parsing logic using matchAll to get order correct or just splitting
            // The split above with capturing groups includes the separators.
            // But simpler manual scan is often safer for mixed content.

            let lastIndex = 0;
            let match;
            const patterns = /\[(.*?)\]\((.*?)\)|(\bhttps?:\/\/[^\s]+)/g;

            while ((match = patterns.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    segments.push({ text: text.substring(lastIndex, match.index), isLink: false });
                }

                if (match[1] && match[2]) {
                    // Markdown link [text](url)
                    segments.push({ text: match[1], url: match[2], isLink: true });
                } else if (match[3]) {
                    // Raw URL
                    segments.push({ text: match[3], url: match[3], isLink: true });
                }
                lastIndex = patterns.lastIndex;
            }
            if (lastIndex < text.length) {
                segments.push({ text: text.substring(lastIndex), isLink: false });
            }

            // Now render manually word-by-word to handle wrapping
            segments.forEach(segment => {
                const words = segment.text.split(/(\s+)/); // Split keeping whitespace

                doc.setTextColor(0, 0, 0); // Always black

                words.forEach(word => {
                    const wordWidth = doc.getTextWidth(word);

                    // Check if word fits
                    if (cursorX + wordWidth > margin + maxWidth) {
                        cursorX = x + hangingIndent; // Reset X to start + hanging indent
                        cursorY += lineHeight;
                        if (checkPageBreak(lineHeight)) { // If page break occurred, reset cursorY
                            cursorY = y;
                        }
                    }

                    doc.text(word, cursorX, cursorY);

                    if (segment.isLink && segment.url) {
                        const safeUrl = segment.url.startsWith('http') ? segment.url : `https://${segment.url}`;

                        // Underline link words
                        doc.setLineWidth(0.5);
                        doc.line(cursorX, cursorY + 1.5, cursorX + wordWidth, cursorY + 1.5);

                        doc.link(cursorX, cursorY - 10, wordWidth, 12, { url: safeUrl });
                    }

                    cursorX += wordWidth;
                });
            });

            doc.setTextColor(0, 0, 0); // Reset
            // Return used height
            return cursorY + lineHeight - initialY;
        };

        // 3. Sections
        if (resumeData.summary) {
            drawSectionHeader("Professional Summary");
            doc.setFont("times", "normal");
            doc.setFontSize(11); // Slightly larger for readability
            // Use rich text for summary too in case of links
            const heightUsed = renderRichText(resumeData.summary, margin, y, contentWidth, 0);
            y += heightUsed + 4;
        }

        if (resumeData.education && resumeData.education.length > 0) {
            drawSectionHeader("Education");
            resumeData.education.forEach(edu => {
                checkPageBreak(50);
                // Institution (Left) & Usage dates (Right)
                doc.setFont("times", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0); // Reset black

                const dateStr = (edu.startDate || edu.endDate) ? `${edu.startDate || ''} - ${edu.endDate || 'Present'}` : "";

                doc.text(edu.institution, margin, y);

                if (dateStr) {
                    doc.setFont("times", "italic");
                    doc.text(dateStr, pageWidth - margin, y, { align: "right" });
                }
                y += 14;

                // Degree (Left) & Location (Right)
                doc.setFont("times", "italic");
                doc.setFontSize(11);
                doc.text(edu.degree, margin, y);

                y += 14;

                if (edu.bullets) {
                    doc.setFont("times", "normal");
                    doc.setFontSize(11); // Standard font size
                    edu.bullets.forEach(b => {
                        checkPageBreak(25); // Heuristic
                        doc.text("• ", margin, y);
                        // Render rich text for bullet content, indented
                        const heightUsed = renderRichText(b, margin + 10, y, contentWidth - 10, 0);
                        y = y + heightUsed - 13; // update absolute y based on renderRichText result, compensating for initial y
                        y += 13; // Move to next line
                    });
                }
                y += 8;
            });
        }

        if (resumeData.experience && resumeData.experience.length > 0) {
            drawSectionHeader("Experience");
            resumeData.experience.forEach(exp => {
                checkPageBreak(50);

                doc.setFont("times", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);

                doc.text(exp.role || "Role", margin, y);

                doc.setFont("times", "italic");
                const dateStr = `${exp.startDate || ''} - ${exp.endDate || 'Present'}`;
                doc.text(dateStr, pageWidth - margin, y, { align: "right" });
                y += 14;

                // Company (Italic Left) & Location (Right)
                doc.setFont("times", "italic");
                doc.text(exp.company || "Company", margin, y);
                if (exp.location) {
                    doc.text(exp.location, pageWidth - margin, y, { align: "right" });
                }
                y += 14;

                doc.setFont("times", "normal");
                doc.setFontSize(11);
                exp.bullets.forEach(h => {
                    checkPageBreak(25);
                    doc.text("• ", margin, y);
                    const heightUsed = renderRichText(h, margin + 10, y, contentWidth - 10, 0);
                    y = y + heightUsed - 13;
                    y += 13;
                });
                y += 8;
            });
        }

        if (resumeData.projects && resumeData.projects.length > 0) {
            drawSectionHeader("Projects");
            resumeData.projects.forEach(project => {
                checkPageBreak(40);
                doc.setFont("times", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);

                // Project Name
                drawTextWithLink(project.name, margin, y, {}, project.link);

                if (project.link) {
                    doc.setFont("times", "italic");
                    doc.setFontSize(10);
                    let domain = project.link;
                    try {
                        domain = project.link.replace(/^https?:\/\//, '').split('/')[0];
                    } catch (e) { /* ignore */ }

                    // Ensure the linkUrl passed is the full original link
                    drawTextWithLink(domain, pageWidth - margin, y, { align: 'right' }, project.link);
                }

                y += 14;

                doc.setFont("times", "normal");
                doc.setFontSize(11);
                project.bullets.forEach(b => {
                    const bulletText = "• " + b;
                    const lines = doc.splitTextToSize(bulletText, contentWidth - 10);
                    checkPageBreak(lines.length * 13);
                    doc.text(lines, margin + 10, y);
                    y += (lines.length * 13);
                });
                y += 8;
            });
        }

        if (resumeData.skills && resumeData.skills.length > 0) {
            drawSectionHeader("Technologies");
            resumeData.skills.forEach(skill => {
                checkPageBreak(25);
                doc.setFont("times", "bold");
                doc.setFontSize(11);
                const label = skill.category + ": ";
                doc.text(label, margin, y);
                const lWidth = doc.getTextWidth(label);

                doc.setFont("times", "normal");
                const itemLines = doc.splitTextToSize(skill.items.join(", "), contentWidth - lWidth);
                doc.text(itemLines, margin + lWidth, y);
                y += (itemLines.length * 13) + 2;
            });
        }

        if (resumeData.certifications && resumeData.certifications.length > 0) {
            drawSectionHeader("Certifications");
            resumeData.certifications.forEach(cert => {
                checkPageBreak(30);
                doc.setFont("times", "bold");
                doc.setFontSize(11);

                // Certification Name
                drawTextWithLink(cert.name, margin, y, {}, cert.url);

                // Date (Right aligned)
                if (cert.date) {
                    doc.setFont("times", "italic");
                    doc.text(cert.date, pageWidth - margin, y, { align: "right" });
                }

                y += 14;

                // Issuer (Italic below name)
                if (cert.issuer) {
                    doc.setFont("times", "italic"); // or normal
                    doc.setFontSize(11);
                    doc.text(cert.issuer, margin, y);
                    y += 14;
                }
            });
            y += 4;
        }

        if (resumeData.achievements && resumeData.achievements.length > 0) {
            drawSectionHeader("Achievements");
            doc.setFont("times", "normal");
            doc.setFontSize(11);
            resumeData.achievements.forEach(ach => {
                checkPageBreak(20);
                doc.text("• ", margin, y);
                const heightUsed = renderRichText(ach, margin + 10, y, contentWidth - 10, 0);
                y = y + heightUsed - 13;
                y += 13;
            });
        }

        const safeName = (resumeData.personal?.name || "Resume").replace(/\s+/g, '_');
        doc.save(`${safeName}_Resume.pdf`);
    };

    return (
        <div className={isStandalone ? "" : "space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-10"}>
            <style>{scrollbarHideStyles}</style>

            {!isStandalone && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 w-full">
                        <Card className="p-8 glass border-white/5 flex flex-col items-center justify-center relative overflow-hidden h-full min-h-[200px]">
                            <div className="absolute top-4 left-4 text-xs font-bold text-white/20 uppercase tracking-widest">Initial Score</div>
                            <div className="text-6xl font-black text-white/40">{iScore}</div>
                            <div className="text-sm text-white/20 mt-2">ATS Compatibility</div>
                        </Card>

                        <Card className="p-8 glass border-primary/20 flex flex-col items-center justify-center relative overflow-hidden neon-glow h-full min-h-[200px]">
                            <div className="absolute top-4 left-4 text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                Optimized <TrendingUp className="w-3 h-3" />
                            </div>
                            <div className="text-7xl font-black text-primary">{fScore}</div>
                            <div className="text-sm text-primary/60 mt-2">
                                {scoreIncrease >= 0 ? '+' : ''}{scoreIncrease}% Improvement
                            </div>
                        </Card>
                    </div>

                    {(matchedKeywords.length > 0 || missingKeywords.length > 0) && (
                        <Card className="p-8 glass border-white/5 space-y-6 relative z-10 w-full overflow-hidden">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold flex items-center gap-3">
                                    <TrendingUp className="text-primary w-6 h-6" /> Skill Gap Analysis
                                </h3>
                                <div className="text-[10px] uppercase tracking-widest text-white/20 font-bold border border-white/10 px-2 py-1 rounded-md">
                                    JD vs RESUME
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Matched Skills */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-green-500 font-bold text-xs uppercase tracking-wider">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Matched Skills ({matchedKeywords.length})
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {matchedKeywords.length > 0 ? (
                                            matchedKeywords.map((skill, i) => (
                                                <motion.span
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    key={i}
                                                    className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium"
                                                >
                                                    {skill}
                                                </motion.span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-white/20 italic">No direct matches found</span>
                                        )}
                                    </div>
                                </div>

                                {/* Missing Skills */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        Talent Gaps ({missingKeywords.length})
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {missingKeywords.length > 0 ? (
                                            missingKeywords.map((skill, i) => (
                                                <motion.span
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    key={i}
                                                    className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"
                                                >
                                                    {skill}
                                                </motion.span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-green-400 italic">No major gaps identified!</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card className="p-8 glass border-white/5 space-y-6 relative z-10 w-full">
                        <h3 className="text-xl font-bold flex items-center gap-3">
                            <CheckCircle className="text-green-500 w-6 h-6" /> Key Improvements
                        </h3>
                        <ul className="space-y-3">
                            {Array.from(new Set(improvements)).map((improvement, i) => (
                                <motion.li
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    key={i}
                                    className="flex items-start gap-3"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <p className="text-sm text-white/80 leading-relaxed">{improvement}</p>
                                </motion.li>
                            ))}
                        </ul>
                    </Card>

                    <div className="flex gap-4 relative z-10 w-full">
                        <Button
                            onClick={downloadPdf}
                            className="flex-1 h-14 rounded-xl bg-white text-black hover:bg-white/90 font-bold"
                        >
                            Download Optimized PDF
                        </Button>
                        <Button
                            onClick={handleFineTune}
                            variant="outline"
                            className="flex-1 h-14 rounded-xl glass border-white/10 font-bold gap-2"
                        >
                            <Edit3 className="w-4 h-4" />
                            Fine-tune Resume
                        </Button>
                    </div>

                </>
            )}

            <AnimatePresence>
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-[#8e949e] flex flex-col overflow-hidden"
                    >
                        {/* High-End Floating Toolbar */}
                        <div className="fixed top-6 right-8 z-[110] flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => isStandalone ? window.close() : setIsEditing(false)}
                                className="bg-white border-black/10 text-black hover:bg-white/90 shadow-lg font-bold"
                            >
                                {isStandalone ? "Finish & Exit" : "Close"}
                            </Button>
                            <Button onClick={handleSaveEdit} className="bg-black text-white hover:bg-black/90 px-10 shadow-2xl font-bold text-lg">
                                Download PDF
                            </Button>
                        </div>

                        {/* Document Workspace */}
                        <div className="flex-1 overflow-y-auto pt-10 pb-32 custom-scrollbar flex flex-col items-center">
                            <motion.div
                                initial={{ y: 30, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="flex flex-col gap-[30px]"
                                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                            >
                                {/* SHEET 1 - 8.5 x 11 inches (Letter) converted to PX */}
                                <div className="w-[816px] min-h-[1056px] bg-white text-black p-[75.6px] shadow-[0_0_60px_rgba(0,0,0,0.3)] flex flex-col relative text-[0] leading-none">
                                    {/* Name Section - Size 24pt (32px) */}
                                    <div className="text-center mb-[18.6px]">
                                        <input
                                            value={resumeData.personal.name}
                                            onChange={(e) => updatePersonal('name', e.target.value)}
                                            className="w-full text-[32px] font-bold text-center outline-none bg-transparent p-0 m-0 border-none leading-none"
                                            placeholder="Full Name"
                                        />
                                        <div className="flex justify-center items-center text-[13.3px] font-normal whitespace-nowrap overflow-hidden mt-[5.3px]">
                                            <input
                                                value={resumeData.personal.location}
                                                onChange={(e) => updatePersonal('location', e.target.value)}
                                                className="text-center outline-none bg-transparent p-0 m-0 border-none"
                                                style={{ width: `${(resumeData.personal.location?.length || 8) * 7.5}px` }}
                                                placeholder="Location"
                                            />
                                            <span className="shrink-0">  |  </span>
                                            <input
                                                value={resumeData.personal.email}
                                                onChange={(e) => updatePersonal('email', e.target.value)}
                                                className="text-center outline-none bg-transparent p-0 m-0 border-none underline"
                                                style={{ width: `${(resumeData.personal.email?.length || 15) * 7.5}px` }}
                                                placeholder="Email"
                                            />
                                            <span className="shrink-0">  |  </span>
                                            <input
                                                value={resumeData.personal.phone}
                                                onChange={(e) => updatePersonal('phone', e.target.value)}
                                                className="text-center outline-none bg-transparent p-0 m-0 border-none underline"
                                                style={{ width: `${(resumeData.personal.phone?.length || 10) * 7.5}px` }}
                                                placeholder="Phone"
                                            />

                                            {/* Dynamic Links (GitHub, LinkedIn, etc.) */}
                                            {resumeData.personal.links && resumeData.personal.links
                                                .filter(l => l.label.toLowerCase() !== 'email')
                                                .map((link, i) => (
                                                    <React.Fragment key={i}>
                                                        <span className="shrink-0">  |  </span>
                                                        <input
                                                            value={link.label}
                                                            onChange={(e) => {
                                                                const originalIndex = resumeData.personal.links?.indexOf(link);
                                                                if (originalIndex !== undefined && originalIndex !== -1) {
                                                                    const newLinks = [...(resumeData.personal.links || [])];
                                                                    newLinks[originalIndex] = { ...newLinks[originalIndex], label: e.target.value };
                                                                    updatePersonal('links', newLinks);
                                                                }
                                                            }}
                                                            className="text-center outline-none bg-transparent underline italic font-normal p-0 m-0 border-none"
                                                            style={{ width: `${(link.label?.length || 8) * 7.5}px` }}
                                                            placeholder="Link Label"
                                                        />
                                                    </React.Fragment>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Summary Section - Gap y+=6, FontSize 12pt, Line y+=4, Content y+=14 */}
                                    {resumeData.summary && (
                                        <div className="mb-[10.6px] text-[#1a1a1a]">
                                            <h3 className="text-[16px] font-bold border-b-[0.67px] border-black mb-[18.6px] pb-[5.3px] leading-none">Professional Summary</h3>
                                            <textarea
                                                value={resumeData.summary}
                                                onChange={(e) => setResumeData(prev => ({ ...prev, summary: e.target.value }))}
                                                className="w-full bg-transparent outline-none hide-scrollbar text-[14.7px] leading-[17.3px] p-0 m-0 border-none"
                                                rows={Math.max(1, Math.ceil(resumeData.summary.length / 90))}
                                            />
                                        </div>
                                    )}

                                    {/* Education Section */}
                                    {resumeData.education && resumeData.education.length > 0 && (
                                        <div className="mb-[10.6px] text-[#1a1a1a]">
                                            <h3 className="text-[16px] font-bold border-b-[0.67px] border-black mb-[18.6px] pb-[5.3px] leading-none">Education</h3>
                                            {resumeData.education.map((edu, i) => (
                                                <div key={i} className="mb-[18.6px]">
                                                    <div className="flex justify-between items-baseline font-bold text-[14.7px] leading-[17.3px]">
                                                        <input value={edu.institution} onChange={(e) => updateEducation(i, 'institution', e.target.value)} className="w-[70%] outline-none bg-transparent p-0 font-bold m-0 border-none" />
                                                        <input value={`${edu.startDate || ''} - ${edu.endDate || ''}`} onChange={(e) => {
                                                            const parts = e.target.value.split(' - ');
                                                            updateEducation(i, 'startDate', parts[0] || '');
                                                            updateEducation(i, 'endDate', parts[1] || '');
                                                        }} className="w-[30%] text-right outline-none bg-transparent p-0 m-0 border-none italic font-normal text-[14.7px]" />
                                                    </div>
                                                    <div className="italic text-[14.7px] leading-[17.3px]">
                                                        <input value={edu.degree} onChange={(e) => updateEducation(i, 'degree', e.target.value)} className="w-full outline-none bg-transparent p-0 m-0 border-none italic" />
                                                    </div>
                                                    {edu.bullets && edu.bullets.length > 0 && (
                                                        <ul className="list-none ml-0 mt-0 space-y-0">
                                                            {edu.bullets.map((bullet, bi) => (
                                                                <li key={bi} className="flex items-start mb-0">
                                                                    <span className="mr-[13.3px] text-[14.7px] leading-[17.3px] shrink-0">•</span>
                                                                    <textarea
                                                                        value={bullet}
                                                                        onChange={(e) => {
                                                                            const newBullets = [...(edu.bullets || [])];
                                                                            newBullets[bi] = e.target.value;
                                                                            updateEducation(i, 'bullets', newBullets);
                                                                        }}
                                                                        className="w-full bg-transparent outline-none hide-scrollbar text-[14.7px] leading-[17.3px] p-0 m-0 border-none"
                                                                        rows={Math.max(1, Math.ceil(bullet.length / 88))}
                                                                    />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Experience Section */}
                                    {resumeData.experience && resumeData.experience.length > 0 && (
                                        <div className="mb-[10.6px] text-[#1a1a1a]">
                                            <h3 className="text-[16px] font-bold border-b-[0.67px] border-black mb-[18.6px] pb-[5.3px] leading-none">Experience</h3>
                                            {resumeData.experience.map((exp, i) => (
                                                <div key={i} className="mb-[18.6px]">
                                                    <div className="flex justify-between items-baseline font-bold text-[14.7px] leading-[17.3px]">
                                                        <input value={exp.role} onChange={(e) => updateExperience(i, 'role', e.target.value)} className="w-[70%] outline-none bg-transparent p-0 font-bold" />
                                                        <input value={`${exp.startDate || ''} - ${exp.endDate || ''}`} onChange={(e) => {
                                                            const parts = e.target.value.split(' - ');
                                                            updateExperience(i, 'startDate', parts[0]);
                                                            updateExperience(i, 'endDate', parts[1]);
                                                        }} className="w-[30%] text-right outline-none bg-transparent p-0 italic font-normal text-[14.7px]" />
                                                    </div>
                                                    <div className="flex justify-between items-baseline italic text-[14.7px] leading-[17.3px]">
                                                        <input value={exp.company} onChange={(e) => updateExperience(i, 'company', e.target.value)} className="w-[60%] outline-none bg-transparent p-0 italic" />
                                                        <input value={exp.location} onChange={(e) => updateExperience(i, 'location', e.target.value)} className="w-[40%] text-right outline-none bg-transparent p-0 italic" />
                                                    </div>
                                                    <ul className="list-none ml-0 mt-0 space-y-0">
                                                        {exp.bullets.map((bullet, bi) => (
                                                            <li key={bi} className="flex items-start mb-0">
                                                                <span className="mr-[13.3px] text-[14.7px] leading-[17.3px] shrink-0">•</span>
                                                                <textarea
                                                                    value={bullet}
                                                                    onChange={(e) => {
                                                                        const newBullets = [...exp.bullets];
                                                                        newBullets[bi] = e.target.value;
                                                                        updateExperience(i, 'bullets', newBullets);
                                                                    }}
                                                                    className="w-full bg-transparent outline-none hide-scrollbar text-[14.7px] leading-[17.3px] p-0 m-0 border-none"
                                                                    rows={Math.max(1, Math.ceil(bullet.length / 88))}
                                                                />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Projects Section - Gap y+=8, Content y+=14 */}
                                    {resumeData.projects && resumeData.projects.length > 0 && (
                                        <div className="mb-[10.6px] text-[#1a1a1a]">
                                            <h3 className="text-[16px] font-bold border-b-[0.67px] border-black mb-[18.6px] pb-[5.3px] leading-none">Projects</h3>
                                            {resumeData.projects.map((project, i) => (
                                                <div key={i} className="mb-[18.6px]">
                                                    <div className="flex justify-between items-baseline font-bold text-[14.7px] leading-[17.3px]">
                                                        <input value={project.name} onChange={(e) => updateProject(i, 'name', e.target.value)} className="w-[70%] outline-none bg-transparent p-0 m-0 border-none font-bold underline" />
                                                        <input value={project.link || ''} onChange={(e) => updateProject(i, 'link', e.target.value)} className="w-[30%] text-right outline-none bg-transparent p-0 m-0 italic font-normal underline text-[14.7px]" placeholder="github.com" />
                                                    </div>
                                                    <ul className="list-none ml-0 mt-0 space-y-0">
                                                        {project.bullets.map((bullet, bi) => (
                                                            <li key={bi} className="flex items-start mb-0">
                                                                <span className="mr-[13.3px] text-[14.7px] leading-[17.3px] shrink-0">•</span>
                                                                <textarea
                                                                    value={bullet}
                                                                    onChange={(e) => {
                                                                        const newBullets = [...project.bullets];
                                                                        newBullets[bi] = e.target.value;
                                                                        updateProject(i, 'bullets', newBullets);
                                                                    }}
                                                                    className="w-full bg-transparent outline-none hide-scrollbar text-[14.7px] leading-[17.3px] p-0 m-0 border-none"
                                                                    rows={Math.max(1, Math.ceil(bullet.length / 88))}
                                                                />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Technologies Section - PDF Tight Logic (y+=2 padding) */}
                                    {resumeData.skills && resumeData.skills.length > 0 && (
                                        <div className="mb-[18.6px] text-[#1a1a1a]">
                                            <h3 className="text-[16px] font-bold border-b-[0.67px] border-black mb-[18.6px] pb-[5.3px] leading-none">Technologies</h3>
                                            {resumeData.skills.map((cat, ci) => (
                                                <div key={ci} className="mb-[2.6px] flex text-[14.7px] leading-[17.3px] items-start">
                                                    <div className="w-fit min-w-[100px] font-bold shrink-0">
                                                        <input
                                                            value={cat.category + ": "}
                                                            onChange={(e) => {
                                                                setResumeData(prev => {
                                                                    const newSkills = [...prev.skills];
                                                                    newSkills[ci] = { ...newSkills[ci], category: e.target.value.replace(": ", "") };
                                                                    return { ...prev, skills: newSkills };
                                                                });
                                                            }}
                                                            className="w-full outline-none bg-transparent p-0 m-0 border-none font-bold"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <textarea
                                                            value={cat.items.join(", ")}
                                                            onChange={(e) => {
                                                                setResumeData(prev => {
                                                                    const newSkills = [...prev.skills];
                                                                    newSkills[ci] = { ...newSkills[ci], items: e.target.value.split(",").map(s => s.trim()) };
                                                                    return { ...prev, skills: newSkills };
                                                                });
                                                            }}
                                                            className="w-full bg-transparent outline-none hide-scrollbar p-0 m-0 border-none"
                                                            rows={Math.max(1, Math.ceil(cat.items.join(", ").length / 105))}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Certifications Section */}
                                    {resumeData.certifications && resumeData.certifications.length > 0 && (
                                        <div className="mb-[10.6px] text-[#1a1a1a]">
                                            <h3 className="text-[16px] font-bold border-b-[0.67px] border-black mb-[18.6px] pb-[5.3px] leading-none">Certifications</h3>
                                            {resumeData.certifications.map((cert, i) => (
                                                <div key={i} className="mb-[14.7px]">
                                                    <div className="flex justify-between items-baseline font-bold text-[14.7px] leading-[17.3px]">
                                                        <input value={cert.name} onChange={(e) => updateCertification(i, 'name', e.target.value)} className="w-[70%] outline-none bg-transparent p-0 m-0 border-none font-bold underline" />
                                                        <input value={cert.date} onChange={(e) => updateCertification(i, 'date', e.target.value)} className="w-[30%] text-right outline-none bg-transparent p-0 m-0 italic font-normal text-[14.7px]" />
                                                    </div>
                                                    <input value={cert.issuer} onChange={(e) => updateCertification(i, 'issuer', e.target.value)} className="w-full outline-none bg-transparent p-0 m-0 border-none italic text-[14.7px] leading-[17.3px]" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* SHEET 2 (Physical Gap in Workspace) */}
                                <div className="w-[816px] min-h-[1056px] bg-white text-black p-[75.6px] shadow-[0_0_60px_rgba(0,0,0,0.3)] flex flex-col relative text-[0] leading-none">
                                    {/* Achievements Section moved to Page 2 to match PDF Exactly */}
                                    {resumeData.achievements && resumeData.achievements.length > 0 && (
                                        <div className="mb-[10.6px] text-[#1a1a1a]">
                                            <h3 className="text-[16px] font-bold border-b-[0.67px] border-black mb-[18.6px] pb-[5.3px] leading-none">Achievements</h3>
                                            <ul className="list-none ml-0 space-y-0">
                                                {resumeData.achievements.map((ach, i) => (
                                                    <li key={i} className="flex items-start mb-0">
                                                        <span className="mr-[13.3px] text-[14.7px] leading-[17.3px] shrink-0">•</span>
                                                        <textarea
                                                            value={ach}
                                                            onChange={(e) => updateAchievement(i, e.target.value)}
                                                            className="w-full bg-transparent outline-none hide-scrollbar text-[14.7px] leading-[17.3px] p-0 m-0 border-none"
                                                            rows={Math.max(1, Math.ceil(ach.length / 88))}
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
