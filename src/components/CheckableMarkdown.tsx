import React, { useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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
    'review', 'verify', 'test', 'fix', 'optimize'
  ];
  
  const lowerText = text.toLowerCase();
  return actionKeywords.some(keyword => lowerText.includes(keyword));
};

export const CheckableMarkdown: React.FC<CheckableMarkdownProps> = ({
  content,
  completedItems,
  onToggleItem,
  onTotalItemsChange,
  showOnlyPending = false,
}) => {
  // Count and track actionable items
  const actionableItems = useMemo(() => {
    const items: { hash: string; text: string }[] = [];
    let itemIndex = 0;

    // Match list items and table cells that look actionable
    const listItemRegex = /^[\\s]*[-*•]\s+(.+)$/gm;
    const tableRowRegex = /\|([^|]+)\|/g;

    // Extract from list items
    let match;
    while ((match = listItemRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (isActionableItem(text) && text.length > 10) {
        items.push({
          hash: generateItemHash(text, itemIndex++),
          text,
        });
      }
    }

    // Extract from table cells (first column usually contains the action)
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('|') && !line.includes('---')) {
        const cells = line.split('|').filter(cell => cell.trim());
        if (cells.length > 0) {
          const firstCell = cells[0].trim();
          if (isActionableItem(firstCell) && firstCell.length > 10) {
            items.push({
              hash: generateItemHash(firstCell, itemIndex++),
              text: firstCell,
            });
          }
        }
      }
    }

    return items;
  }, [content]);

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

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        li: ListItem,
        td: TableCell,
        // Keep existing styling for other elements
        h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
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
      {content}
    </ReactMarkdown>
  );
};
