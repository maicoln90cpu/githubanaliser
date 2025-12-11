import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CheckableMarkdownProps {
  content: string;
  completedItems: Set<string>;
  onToggleItem: (itemHash: string) => void;
  onTotalItemsChange: (count: number) => void;
  showOnlyPending?: boolean;
}

// Generate a consistent hash for an item based on its content
const generateItemHash = (text: string, index: number): string => {
  const cleanText = text.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 50);
  return `item-${index}-${cleanText}`;
};

// Check if text looks like an actionable item
const isActionableItem = (text: string): boolean => {
  const actionKeywords = [
    'implementar', 'criar', 'adicionar', 'configurar', 'atualizar',
    'revisar', 'verificar', 'testar', 'corrigir', 'otimizar',
    'definir', 'estabelecer', 'desenvolver', 'integrar', 'migrar',
    'documentar', 'remover', 'refatorar', 'melhorar', 'validar',
    'implement', 'create', 'add', 'configure', 'update',
    'review', 'verify', 'test', 'fix', 'optimize',
    // Additional keywords for broader coverage
    'setup', 'deploy', 'publish', 'build', 'run', 'preview', 'install',
    'analisar', 'executar', 'preparar', 'monitorar', 'automatizar',
    'habilitar', 'desabilitar', 'ativar', 'desativar', 'incluir',
    'excluir', 'exportar', 'importar', 'sincronizar', 'publicar',
    'lançar', 'versionar', 'manter', 'suportar', 'garantir',
    'enable', 'disable', 'activate', 'deactivate', 'include',
    'exclude', 'export', 'import', 'sync', 'launch', 'version',
    'maintain', 'support', 'ensure', 'monitor', 'automate'
  ];
  
  const lowerText = text.toLowerCase();
  return actionKeywords.some(keyword => lowerText.includes(keyword));
};

// Check if text should be checkable in table context (more permissive)
const isTableItemCheckable = (text: string): boolean => {
  // All table items with meaningful content are checkable
  const cleanText = text.trim();
  // Exclude headers, empty cells, and purely numeric/date values
  if (!cleanText || cleanText.length < 3) return false;
  if (/^[\d\s\-\/\.\,\:]+$/.test(cleanText)) return false; // Pure numbers/dates
  if (/^(#|---|\*\*\*)/.test(cleanText)) return false; // Markdown separators
  return true;
};

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

export const CheckableMarkdown: React.FC<CheckableMarkdownProps> = ({
  content,
  completedItems,
  onToggleItem,
  onTotalItemsChange,
  showOnlyPending = false,
}) => {
  // Pre-process content to fix <br> tags in markdown
  const processedContent = useMemo(() => {
    return content.replace(/<br\s*\/?>/gi, '\n');
  }, [content]);
  // Count and track actionable items
  const actionableItems = useMemo(() => {
    const items: { hash: string; text: string }[] = [];
    let itemIndex = 0;
    const seenTexts = new Set<string>();

    // Match list items and table cells that look actionable
    const listItemRegex = /^[\s]*[-*•]\s+(.+)$/gm;

    // Extract from list items
    let match;
    while ((match = listItemRegex.exec(processedContent)) !== null) {
      const text = match[1].trim();
      const lowerText = text.toLowerCase().trim();
      // Removed text.length > 10 requirement - now accepts shorter items
      if (isActionableItem(text) && text.length >= 3 && !seenTexts.has(lowerText)) {
        seenTexts.add(lowerText);
        items.push({
          hash: generateItemHash(text, itemIndex++),
          text,
        });
      }
    }

    // Extract from table cells - ALL cells in first column are now checkable
    const lines = processedContent.split('\n');
    let isInTable = false;
    let headerPassed = false;
    
    for (const line of lines) {
      if (line.includes('|')) {
        isInTable = true;
        // Skip separator row (---)
        if (line.includes('---')) {
          headerPassed = true;
          continue;
        }
        // Skip header row (first row before ---)
        if (isInTable && !headerPassed) {
          continue;
        }
        
        const cells = line.split('|').filter(cell => cell.trim());
        if (cells.length > 0) {
          const firstCell = cells[0].trim();
          const lowerText = firstCell.toLowerCase().trim();
          // Use more permissive isTableItemCheckable for table cells
          if (isTableItemCheckable(firstCell) && !seenTexts.has(lowerText)) {
            seenTexts.add(lowerText);
            items.push({
              hash: generateItemHash(firstCell, itemIndex++),
              text: firstCell,
            });
          }
        }
      } else {
        // Reset table state when leaving table
        isInTable = false;
        headerPassed = false;
      }
    }

    return items;
  }, [processedContent]);

  useEffect(() => {
    onTotalItemsChange(actionableItems.length);
  }, [actionableItems.length, onTotalItemsChange]);

  // Create a map of text to hash for quick lookup
  const textToHashMap = useMemo(() => {
    const map = new Map<string, string>();
    actionableItems.forEach(item => {
      map.set(item.text.toLowerCase().trim(), item.hash);
    });
    return map;
  }, [actionableItems]);

  // Custom component for list items
  const ListItem = ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => {
    const text = React.Children.toArray(children)
      .map(child => {
        if (typeof child === 'string') return child;
        if (React.isValidElement(child) && child.props?.children) {
          return typeof child.props.children === 'string' ? child.props.children : '';
        }
        return '';
      })
      .join('')
      .trim();

    const hash = textToHashMap.get(text.toLowerCase().trim());
    const isCheckable = hash !== undefined;
    const isCompleted = hash ? completedItems.has(hash) : false;

    if (showOnlyPending && isCompleted) {
      return null;
    }

    if (isCheckable && hash) {
      return (
        <li
          {...props}
          className={cn(
            'flex items-start gap-3 py-1.5 group transition-all',
            isCompleted && 'opacity-60'
          )}
        >
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => onToggleItem(hash)}
            className="mt-1 shrink-0"
          />
          <span className={cn(
            'flex-1 transition-all',
            isCompleted && 'line-through text-muted-foreground'
          )}>
            {children}
          </span>
        </li>
      );
    }

    return <li {...props}>{children}</li>;
  };

  // Custom component for table cells
  const TableCell = ({ children, ...props }: React.ComponentPropsWithoutRef<'td'>) => {
    const text = React.Children.toArray(children)
      .map(child => (typeof child === 'string' ? child : ''))
      .join('')
      .trim();

    const hash = textToHashMap.get(text.toLowerCase().trim());
    const isCheckable = hash !== undefined;
    const isCompleted = hash ? completedItems.has(hash) : false;

    if (isCheckable && hash) {
      return (
        <td {...props} className="py-2 px-3">
          <div className={cn(
            'flex items-center gap-2 transition-all',
            isCompleted && 'opacity-60'
          )}>
            <Checkbox
              checked={isCompleted}
              onCheckedChange={() => onToggleItem(hash)}
              className="shrink-0"
            />
            <span className={cn(
              isCompleted && 'line-through text-muted-foreground'
            )}>
              {children}
            </span>
          </div>
        </td>
      );
    }

    return <td {...props} className="py-2 px-3">{children}</td>;
  };

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
        li: ListItem,
        td: TableCell,
        h1: ({ children }) => <HeadingWithCopy level={1}>{children}</HeadingWithCopy>,
        h2: ({ children }) => <HeadingWithCopy level={2}>{children}</HeadingWithCopy>,
        h3: ({ children }) => <HeadingWithCopy level={3}>{children}</HeadingWithCopy>,
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="space-y-1 mb-4">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4">{children}</ol>,
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

// Re-export with processed content
CheckableMarkdown.displayName = 'CheckableMarkdown';
