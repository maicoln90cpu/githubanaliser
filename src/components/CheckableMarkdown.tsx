import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface MarkdownRendererProps {
  content: string;
}

// Extract section content from markdown
const extractSectionContent = (content: string, sectionTitle: string): string => {
  const lines = content.split('\n');
  const sectionIndex = lines.findIndex(line => 
    line.includes(sectionTitle) && (line.startsWith('#') || line.startsWith('##') || line.startsWith('###'))
  );
  
  if (sectionIndex === -1) return '';
  
  const currentLevel = lines[sectionIndex].match(/^#+/)?.[0].length || 2;
  let endIndex = lines.length;
  
  for (let i = sectionIndex + 1; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#+)/);
    if (headingMatch && headingMatch[1].length <= currentLevel) {
      endIndex = i;
      break;
    }
  }
  
  return lines.slice(sectionIndex, endIndex).join('\n').trim();
};

// Copy button component
const CopyButton = ({ content, sectionTitle }: { content: string; sectionTitle: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const sectionContent = extractSectionContent(content, sectionTitle);
    
    try {
      await navigator.clipboard.writeText(sectionContent || sectionTitle);
      setCopied(true);
      toast.success('Copiado para área de transferência');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  );
};

export const CheckableMarkdown: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Pre-process content to fix <br> tags in markdown
  const processedContent = useMemo(() => {
    return content.replace(/<br\s*\/?>/gi, '\n');
  }, [content]);

  // Heading with copy button
  const HeadingWithCopy = ({ level, children }: { level: 1 | 2 | 3; children: React.ReactNode }) => {
    const text = React.Children.toArray(children)
      .map(child => (typeof child === 'string' ? child : ''))
      .join('');

    const baseClasses = {
      1: 'text-2xl font-bold mt-6 mb-4',
      2: 'text-xl font-semibold mt-5 mb-3',
      3: 'text-lg font-medium mt-4 mb-2',
    };

    const Tag = `h${level}` as keyof JSX.IntrinsicElements;

    return (
      <Tag className={cn(baseClasses[level], 'flex items-center group')}>
        {children}
        <CopyButton content={processedContent} sectionTitle={text} />
      </Tag>
    );
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <HeadingWithCopy level={1}>{children}</HeadingWithCopy>,
        h2: ({ children }) => <HeadingWithCopy level={2}>{children}</HeadingWithCopy>,
        h3: ({ children }) => <HeadingWithCopy level={3}>{children}</HeadingWithCopy>,
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4">{children}</ol>,
        li: ({ children }) => <li className="py-0.5">{children}</li>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="w-full border-collapse border border-border rounded-lg">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
        th: ({ children }) => <th className="py-2 px-3 text-left font-semibold border-b border-border">{children}</th>,
        tr: ({ children }) => <tr className="border-b border-border hover:bg-muted/50 transition-colors">{children}</tr>,
        td: ({ children }) => <td className="py-2 px-3">{children}</td>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted/30 rounded-r">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{children}</code>
          ) : (
            <code className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm">{children}</code>
          );
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {children}
          </a>
        ),
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
};

CheckableMarkdown.displayName = 'CheckableMarkdown';
