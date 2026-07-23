import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface MarkdownBodyProps {
  markdown: string;
}

/** Lightweight markdown renderer — headings, lists, paragraphs, bold, links. */
export function MarkdownBody({ markdown }: MarkdownBodyProps) {
  const blocks = markdown.split(/\n\n+/);

  return (
    <Box
      sx={{
        '& h1, & h2, & h3': { fontWeight: 700, mt: 2, mb: 1 },
        '& h1': { fontSize: '1.75rem' },
        '& h2': { fontSize: '1.35rem' },
        '& h3': { fontSize: '1.1rem' },
        '& p': { mb: 1.5, color: 'text.secondary' },
        '& ul': { pl: 3, mb: 1.5, color: 'text.secondary' },
        '& li': { mb: 0.5 },
        '& a': { color: 'primary.main' },
        '& code': {
          fontFamily: 'monospace',
          fontSize: '0.9em',
          bgcolor: 'rgba(255,255,255,0.06)',
          px: 0.5,
          borderRadius: 0.5,
        },
        '& .md-table-scroll': {
          display: 'block',
          width: '100%',
          overflowX: 'auto',
          mb: 2,
          WebkitOverflowScrolling: 'touch',
        },
        '& table': { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
        '& th, & td': {
          border: '1px solid',
          borderColor: 'divider',
          px: 1,
          py: 0.75,
          color: 'text.secondary',
          whiteSpace: 'nowrap',
        },
        '& th': { fontWeight: 600 },
      }}
    >
      {blocks.map((block, index) => renderBlock(block, index))}
    </Box>
  );
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key++}>{token.slice(2, -2)}</strong>,
      );
    } else if (token.startsWith('`')) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
            {linkMatch[1]}
          </a>,
        );
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length ? parts : [text];
}

function renderBlock(block: string, index: number): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('# ')) {
    return (
      <Typography key={index} variant="h4" component="h1">
        {renderInline(trimmed.slice(2))}
      </Typography>
    );
  }
  if (trimmed.startsWith('## ')) {
    return (
      <Typography key={index} variant="h5" component="h2">
        {renderInline(trimmed.slice(3))}
      </Typography>
    );
  }
  if (trimmed.startsWith('### ')) {
    return (
      <Typography key={index} variant="h6" component="h3">
        {renderInline(trimmed.slice(4))}
      </Typography>
    );
  }

  if (trimmed.startsWith('|')) {
    const rows = trimmed.split('\n').filter((r) => r.trim() && !/^\|[-\s|]+\|$/.test(r.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      const headCells = head.split('|').filter(Boolean).map((c) => c.trim());
      return (
        <Box key={index} className="md-table-scroll">
          <Box component="table">
          <thead>
            <tr>
              {headCells.map((cell, i) => (
                <th key={i}>{renderInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => {
              const cells = row.split('|').filter(Boolean).map((c) => c.trim());
              return (
                <tr key={ri}>
                  {cells.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          </Box>
        </Box>
      );
    }
  }

  const lines = trimmed.split('\n');
  if (lines.every((l) => l.startsWith('- ') || l.startsWith('* ') || /^- \[[ x]\]/.test(l))) {
    return (
      <Box key={index} component="ul">
        {lines.map((line, li) => {
          const checked = /^- \[x\]/.test(line);
          const unchecked = /^- \[ \]/.test(line);
          const text = line
            .replace(/^[-*] /, '')
            .replace(/^- \[[ x]\] /, '');
          return (
            <Box key={li} component="li">
              {checked ? '☑ ' : unchecked ? '☐ ' : null}
              {renderInline(text)}
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Typography key={index} variant="body1" component="p">
      {renderInline(trimmed.replace(/\n/g, ' '))}
    </Typography>
  );
}
