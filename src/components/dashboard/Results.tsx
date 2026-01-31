"use client";

import { motion } from "framer-motion";
import { CheckCircle, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResumeJSON } from "@/types/resume";

interface ResultsProps {
    initialScore: number;
    finalScore: number;
    improvements: string[];
    resumeData: ResumeJSON;
    yaml?: string;
}

export function Results({ initialScore, finalScore, improvements, resumeData, yaml }: ResultsProps) {
    // Normalize scores to 0-100 scale
    // If score is <= 1 (e.g. 0.7), multiply by 100. If > 1 (e.g. 70), keep it.
    const normalize = (s: number) => (s <= 1 ? Math.round(s * 100) : Math.round(s));

    const iScore = normalize(initialScore);
    const fScore = normalize(finalScore);
    const scoreIncrease = fScore - iScore;

    const downloadYaml = () => {
        let yamlContent = yaml;

        if (!yamlContent) {
            if (!resumeData || !resumeData.personal) {
                alert("Resume data is missing. Please try again.");
                return;
            }
            // Fallback: Mock YAML generation from resumeData
            yamlContent = `cv:
  name: ${resumeData.personal.name}
  email: ${resumeData.personal.email || ''}
  phone: ${resumeData.personal.phone || ''}
  location: ${resumeData.personal.location || ''}
  social_networks:
${resumeData.personal.links?.map(link => `    - network: ${link.label}\n      username: ${link.url}`).join('\n') || ''}
  sections:
    summary:
      - ${resumeData.summary || ''}
    experience:
${resumeData.experience.map(exp => `      - company: ${exp.company || ''}
        position: ${exp.role || ''}
        location: ${exp.location || ''}
        start_date: ${exp.startDate || ''}
        end_date: ${exp.endDate || 'Present'}
        highlights:
${exp.bullets.map(b => `          - ${b}`).join('\n')}`).join('\n')}
`;
        }
        const blob = new Blob([yamlContent], { type: "text/yaml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "optimized-resume.yaml";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
            resumeData.personal.links.forEach(l => contactItems.push({ text: l.label || l.url, url: l.url }));
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

                doc.text(exp.role, margin, y);

                doc.setFont("times", "italic");
                const dateStr = `${exp.startDate} - ${exp.endDate || 'Present'}`;
                doc.text(dateStr, pageWidth - margin, y, { align: "right" });
                y += 14;

                // Company (Italic Left) & Location (Right)
                doc.setFont("times", "italic");
                doc.text(exp.company, margin, y);
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-10">
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

            <Card className="p-8 glass border-white/5 space-y-6 relative z-10 w-full">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-6 h-6" /> Key Improvements
                </h3>
                <div className="flex flex-wrap gap-4">
                    {improvements.map((improvement, i) => (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                            <p className="text-sm text-white/80">{improvement}</p>
                        </motion.div>
                    ))}
                </div>
            </Card>

            <div className="flex gap-4 relative z-10 w-full">
                <Button
                    onClick={downloadPdf}
                    className="flex-1 h-14 rounded-xl bg-white text-black hover:bg-white/90 font-bold"
                >
                    Download Optimized PDF
                </Button>
                <Button
                    onClick={downloadYaml}
                    variant="outline"
                    className="flex-1 h-14 rounded-xl glass border-white/10 font-bold"
                >
                    Export RenderCV YAML
                </Button>
            </div>
        </div>
    );
}
