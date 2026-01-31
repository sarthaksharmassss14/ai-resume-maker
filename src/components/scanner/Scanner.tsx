"use client";

import { motion } from "framer-motion";
import { FileText, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScannerProps {
    isScanning: boolean;
    progress: number;
    statusText: string;
    icon?: LucideIcon;
}

export function Scanner({ isScanning, progress, statusText, icon: Icon = FileText }: ScannerProps) {
    return (
        <div className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-2xl overflow-hidden glass border-2 border-white/5 neon-glow">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />

            {/* Document Icon */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Icon className={cn("w-24 h-24 text-primary transition-all duration-500", isScanning && "animate-pulse")} />
                <p className="text-white/60 font-medium tracking-wider uppercase text-xs">{statusText}</p>
            </div>

            {/* Scanning Bar */}
            {isScanning && (
                <motion.div
                    initial={{ top: "0%" }}
                    animate={{ top: "100%" }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgba(139,92,246,0.8)] z-10"
                />
            )}

            {/* Progress Bar (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/5">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-primary"
                />
            </div>
        </div>
    );
}
