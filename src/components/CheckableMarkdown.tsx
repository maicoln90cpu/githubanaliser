import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Copy, Check, AlertTriangle, Info, CheckCircle2, Lightbulb } from 'lucide-react';
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
      className="h-7 w-7 p-0 ml-2 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-accent" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground hover:text-primary" />
      )}
    </Button>
  );
};

// Callout type detection
const getCalloutType = (text: string): 'warning' | 'success' | 'info' | 'tip' | null => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('⚠️') || lowerText.includes('warning') || lowerText.includes('atenção') || lowerText.includes('cuidado')) {
    return 'warning';
  }
  if (lowerText.includes('✅') || lowerText.includes('success') || lowerText.includes('sucesso')) {
    return 'success';
  }
  if (lowerText.includes('ℹ️') || lowerText.includes('info') || lowerText.includes('nota:')) {
    return 'info';
  }
  if (lowerText.includes('💡') || lowerText.includes('dica') || lowerText.includes('tip')) {
    return 'tip';
  }
  return null;
};

const calloutStyles = {
  warning: {
    container: 'border-l-destructive bg-destructive/5',
    icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
  },
  success: {
    container: 'border-l-accent bg-accent/5',
    icon: <CheckCircle2 className="h-5 w-5 text-accent" />,
  },
  info: {
    container: 'border-l-[hsl(200,80%,50%)] bg-[hsl(200,80%,50%,0.05)]',
    icon: <Info className="h-5 w-5 text-[hsl(200,80%,50%)]" />,
  },
  tip: {
    container: 'border-l-[hsl(45,90%,50%)] bg-[hsl(45,90%,50%,0.05)]',
    icon: <Lightbulb className="h-5 w-5 text-[hsl(45,90%,50%)]" />,
  },
};

export const CheckableMarkdown: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Pre-process content to fix <br> tags in markdown
  const processedContent = useMemo(() => {
    return content.replace(/<br\s*\/?>/gi, '\n');
  }, [content]);

  // Heading with copy button
  const HeadingWithCopy = ({ level, children }: { level: 1 | 2 | 3 | 4; children: React.ReactNode }) => {
    const text = React.Children.toArray(children)
      .map(child => (typeof child === 'string' ? child : ''))
      .join('');

    const baseStyles = {
      1: 'text-2xl font-bold mb-6 mt-10 first:mt-0 bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-primary pl-4 py-3 rounded-r-lg',
      2: 'text-xl font-bold mb-4 mt-8 bg-muted/50 px-4 py-2.5 rounded-lg border border-border/50',
      3: 'text-lg font-semibold mb-3 mt-6 border-b border-border/50 pb-2',
      4: 'text-base font-semibold mb-2 mt-4',
    };

    const Tag = `h${level}` as keyof JSX.IntrinsicElements;

    return (
      <Tag className={cn(baseStyles[level], 'flex items-center group transition-colors duration-200 hover:text-primary')}>
        {level === 2 && <span className="text-primary text-sm mr-2">◆</span>}
        <span className="flex-1">{children}</span>
        <CopyButton content={processedContent} sectionTitle={text} />
      </Tag>
    );
  };

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <HeadingWithCopy level={1}>{children}</HeadingWithCopy>,
          h2: ({ children }) => <HeadingWithCopy level={2}>{children}</HeadingWithCopy>,
          h3: ({ children }) => <HeadingWithCopy level={3}>{children}</HeadingWithCopy>,
          h4: ({ children }) => <HeadingWithCopy level={4}>{children}</HeadingWithCopy>,
          p: ({ children }) => <p className="mb-4 text-muted-foreground leading-7">{children}</p>,
          ul: ({ children }) => <ul className="pl-0 mb-5 space-y-2 list-none">{children}</ul>,
          ol: ({ children }) => <ol className="pl-0 mb-5 space-y-2 list-none">{children}</ol>,
          li: ({ children }) => (
            <li className="text-muted-foreground pl-6 relative">
              <span className="absolute left-0 text-primary font-bold">▸</span>
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm bg-card rounded-xl overflow-hidden shadow-md border border-border/50">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-primary/15 to-primary/5">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3.5 text-left font-semibold text-foreground border-b-2 border-primary/20 text-sm uppercase tracking-wide">
              {children}
            </th>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-border/30 transition-all duration-200 hover:bg-primary/5 even:bg-muted/20">
              {children}
            </tr>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-muted-foreground">
              {children}
            </td>
          ),
          blockquote: ({ children }) => {
            // Try to detect callout type from children text
            const childText = React.Children.toArray(children)
              .map(child => {
                if (React.isValidElement(child) && child.props?.children) {
                  return String(child.props.children);
                }
                return String(child);
              })
              .join('');
            
            const calloutType = getCalloutType(childText);
            const styles = calloutType ? calloutStyles[calloutType] : null;

            return (
              <blockquote className={cn(
                'border-l-4 pl-5 py-4 my-5 rounded-r-xl relative overflow-hidden',
                styles?.container || 'border-primary bg-primary/5'
              )}>
                {styles?.icon && (
                  <div className="absolute top-4 right-4">
                    {styles.icon}
                  </div>
                )}
                <div className="relative z-10 pr-10">{children}</div>
              </blockquote>
            );
          },
          code: ({ children, className }) => {
            const isInline = !className;
            
            if (isInline) {
              return (
                <code className="bg-muted/80 px-2 py-1 rounded-md text-sm text-primary font-mono border border-border/50">
                  {children}
                </code>
              );
            }
            
            // Block code with basic syntax highlighting
            return (
              <pre className="bg-[hsl(222,47%,8%)] p-5 rounded-xl overflow-x-auto mb-5 border border-border/30 shadow-lg">
                <code className="text-[hsl(210,40%,90%)] text-sm leading-6 block font-mono">
                  {children}
                </code>
              </pre>
            );
          },
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary font-medium underline decoration-primary/30 underline-offset-2 transition-all duration-200 hover:decoration-primary"
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className="my-10 border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-muted-foreground">{children}</em>
          ),
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt} 
              className="rounded-xl shadow-lg my-6 max-w-full h-auto border border-border/30"
            />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

CheckableMarkdown.displayName = 'CheckableMarkdown';
