import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "search" | "error";
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  variant = "default" 
}: EmptyStateProps) {
  const getIllustration = () => {
    switch (variant) {
      case "search":
        return (
          <svg className="w-32 h-32 mb-4" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" className="fill-muted/50" />
            <circle cx="85" cy="85" r="35" className="stroke-primary" strokeWidth="4" fill="none" />
            <line x1="110" y1="110" x2="140" y2="140" className="stroke-primary" strokeWidth="4" strokeLinecap="round" />
            <path d="M75 80 Q85 70 95 80" className="stroke-muted-foreground" strokeWidth="2" fill="none" />
            <circle cx="75" cy="85" r="3" className="fill-muted-foreground" />
            <circle cx="95" cy="85" r="3" className="fill-muted-foreground" />
            <path d="M78 95 Q85 90 92 95" className="stroke-muted-foreground" strokeWidth="2" fill="none" />
          </svg>
        );
      case "error":
        return (
          <svg className="w-32 h-32 mb-4" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" className="fill-destructive/10" />
            <circle cx="100" cy="100" r="50" className="stroke-destructive/50" strokeWidth="3" fill="none" />
            <path d="M80 80 L120 120 M120 80 L80 120" className="stroke-destructive" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg className="w-32 h-32 mb-4" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" className="fill-primary/5" />
            <rect x="60" y="70" width="80" height="60" rx="8" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
            <rect x="70" y="85" width="60" height="4" rx="2" className="fill-primary/30" />
            <rect x="70" y="95" width="40" height="4" rx="2" className="fill-primary/20" />
            <rect x="70" y="105" width="50" height="4" rx="2" className="fill-primary/20" />
            <circle cx="140" cy="60" r="20" className="fill-accent/20 stroke-accent/40" strokeWidth="2" />
            <path d="M133 60 L138 65 L148 55" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {getIllustration()}
      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-md mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="transition-all duration-200 hover:scale-105">
          {action.label}
        </Button>
      )}
    </div>
  );
}
