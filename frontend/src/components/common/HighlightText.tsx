import React from 'react';

interface HighlightTextProps {
  text: string | null | undefined;
  query?: string | null;
  className?: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const HighlightText: React.FC<HighlightTextProps> = ({ text, query, className }) => {
  if (!text) return null;
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  // Extract non-empty search terms (ignore very short terms like 1 char if needed, or keep all >= 1)
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  try {
    const pattern = `(${terms.map(escapeRegExp).join('|')})`;
    const regex = new RegExp(pattern, 'gi');
    const parts = text.split(regex);

    return (
      <span className={className}>
        {parts.map((part, index) => {
          const isMatch = terms.some((t) => t.toLowerCase() === part.toLowerCase());
          if (isMatch) {
            return (
              <mark key={index} className="search-highlight-mark">
                {part}
              </mark>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </span>
    );
  } catch {
    return <span className={className}>{text}</span>;
  }
};
