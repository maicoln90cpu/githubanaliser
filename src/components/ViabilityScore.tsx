import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ViabilityScoreProps {
  content: string;
  className?: string;
}

export function ViabilityScore({ content, className }: ViabilityScoreProps) {
  const score = useMemo(() => {
    // Try to extract score from markdown content
    // Look for patterns like "Score: 85" or "Viabilidade: 72/100" or "**Score:** 90"
    const patterns = [
      /(?:score|viabilidade|pontuação)[\s:]*(\d{1,3})(?:\/100)?/i,
      /(?:score|viabilidade|pontuação)\s*[:\-]\s*\*?\*?(\d{1,3})\*?\*?/i,
      /(\d{1,3})(?:\/100|\s*(?:pontos|pts))/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const value = parseInt(match[1], 10);
        if (value >= 0 && value <= 100) {
          return value;
        }
      }
    }

    // If no explicit score found, calculate based on content analysis
    return calculateImplicitScore(content);
  }, [content]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-green-500 to-emerald-400";
    if (score >= 60) return "from-yellow-500 to-amber-400";
    if (score >= 40) return "from-orange-500 to-amber-500";
    return "from-red-500 to-rose-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bom";
    if (score >= 40) return "Regular";
    return "Precisa Melhorar";
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-xl bg-card border border-border", className)}>
      {/* Circular Progress */}
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={`stop-color-current ${getScoreColor(score)}`} stopColor="currentColor" />
              <stop offset="100%" className={`stop-color-current ${getScoreColor(score)}`} stopColor="currentColor" />
            </linearGradient>
          </defs>
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-2xl font-bold", getScoreColor(score))}>
            {score}
          </span>
        </div>
      </div>

      {/* Score info */}
      <div className="flex-1">
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          Score de Viabilidade
        </h3>
        <p className={cn("text-lg font-semibold", getScoreColor(score))}>
          {getScoreLabel(score)}
        </p>
        <div className="mt-2 flex gap-2">
          <div className={cn(
            "h-1.5 rounded-full flex-1 transition-all",
            score >= 25 ? `bg-gradient-to-r ${getScoreGradient(score)}` : "bg-muted/30"
          )} />
          <div className={cn(
            "h-1.5 rounded-full flex-1 transition-all",
            score >= 50 ? `bg-gradient-to-r ${getScoreGradient(score)}` : "bg-muted/30"
          )} />
          <div className={cn(
            "h-1.5 rounded-full flex-1 transition-all",
            score >= 75 ? `bg-gradient-to-r ${getScoreGradient(score)}` : "bg-muted/30"
          )} />
          <div className={cn(
            "h-1.5 rounded-full flex-1 transition-all",
            score >= 90 ? `bg-gradient-to-r ${getScoreGradient(score)}` : "bg-muted/30"
          )} />
        </div>
      </div>
    </div>
  );
}

function calculateImplicitScore(content: string): number {
  let score = 50; // Base score

  // Positive indicators
  const positivePatterns = [
    { pattern: /✅|completo|excelente|robusto|moderno/gi, weight: 2 },
    { pattern: /bem estruturado|organizado|profissional/gi, weight: 3 },
    { pattern: /typescript|react|next\.?js/gi, weight: 1 },
    { pattern: /testes?|testing|jest|vitest/gi, weight: 3 },
    { pattern: /ci\/cd|pipeline|deploy/gi, weight: 2 },
    { pattern: /documentação|readme/gi, weight: 2 },
    { pattern: /authentication|auth|segur/gi, weight: 2 },
  ];

  // Negative indicators
  const negativePatterns = [
    { pattern: /❌|faltando|ausente|vulnerabilidade/gi, weight: -2 },
    { pattern: /⚠️|atenção|problema|issue|bug/gi, weight: -1 },
    { pattern: /sem testes|no tests|untested/gi, weight: -3 },
    { pattern: /sem documentação|undocumented/gi, weight: -2 },
    { pattern: /depreciado|deprecated|legacy/gi, weight: -2 },
    { pattern: /inseguro|unsafe|vulnerável/gi, weight: -3 },
  ];

  for (const { pattern, weight } of positivePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      score += Math.min(matches.length * weight, 10);
    }
  }

  for (const { pattern, weight } of negativePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      score += Math.max(matches.length * weight, -10);
    }
  }

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

export default ViabilityScore;
