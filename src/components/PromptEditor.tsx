import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2, Minimize2, Copy, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PromptEditorProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  minRows?: number;
  maxRows?: number;
  maxChars?: number;
  placeholder?: string;
  className?: string;
}

// Estimate tokens (rough approximation: ~4 chars per token)
const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

export const PromptEditor: React.FC<PromptEditorProps> = ({
  label,
  description,
  value,
  onChange,
  variables = [],
  minRows = 8,
  maxRows = 20,
  maxChars,
  placeholder,
  className,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = value.length;
  const tokenEstimate = estimateTokens(value);
  const isOverLimit = maxChars ? charCount > maxChars : false;
  const warningThreshold = maxChars ? maxChars * 0.9 : null;
  const isNearLimit = warningThreshold ? charCount > warningThreshold : false;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Prompt copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = isFullscreen ? fullscreenTextareaRef.current : textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const insertion = `{{${variable}}}`;
    const newValue = value.substring(0, start) + insertion + value.substring(end);
    onChange(newValue);

    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  // Auto-resize based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && !isFullscreen) {
      textarea.style.height = 'auto';
      const lineHeight = 24; // approximate line height
      const minHeight = minRows * lineHeight;
      const maxHeight = maxRows * lineHeight;
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [value, minRows, maxRows, isFullscreen]);

  const EditorContent = ({ isFullscreenMode = false }: { isFullscreenMode?: boolean }) => (
    <div className={cn("space-y-3", isFullscreenMode && "h-full flex flex-col")}>
      {/* Header with label and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {isOverLimit && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              Limite excedido
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
          {!isFullscreenMode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(true)}
              className="h-7 px-2"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Variables */}
      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Variáveis:</span>
          {variables.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => insertVariable(v)}
            >
              {`{{${v}}}`}
            </Badge>
          ))}
        </div>
      )}

      {/* Textarea */}
      <Textarea
        ref={isFullscreenMode ? fullscreenTextareaRef : textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "font-mono text-sm resize-none transition-colors",
          isFullscreenMode && "flex-1 min-h-[60vh]",
          isOverLimit && "border-destructive focus-visible:ring-destructive",
          isNearLimit && !isOverLimit && "border-yellow-500 focus-visible:ring-yellow-500"
        )}
        style={!isFullscreenMode ? { minHeight: `${minRows * 24}px` } : undefined}
      />

      {/* Footer with counters */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className={cn(
            isOverLimit && "text-destructive font-medium",
            isNearLimit && !isOverLimit && "text-yellow-600 dark:text-yellow-500"
          )}>
            {charCount.toLocaleString()} caracteres
            {maxChars && ` / ${maxChars.toLocaleString()}`}
          </span>
          <span>~{tokenEstimate.toLocaleString()} tokens</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{value.split('\n').length} linhas</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={className}>
        <EditorContent />
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>{label}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 className="w-4 h-4 mr-2" />
                Sair do Fullscreen
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <EditorContent isFullscreenMode />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PromptEditor;
