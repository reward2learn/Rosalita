'use client';

import { useCallback, useEffect, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { MarkdownBody } from '@/components/blocks/markdown-body';

interface AiFinding {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function FindingAccordion({
  finding,
  expanded,
  onToggle,
  onCopy,
  onSummarize,
  isSummarizing,
}: {
  finding: AiFinding;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onSummarize: () => void;
  isSummarizing: boolean;
}) {
  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        '&:before': { display: 'none' },
        bgcolor: 'rgba(235, 61, 40, 0.03)',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', pr: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {finding.title}
            </Typography>
          </Box>
          <Chip label={formatDate(finding.createdAt)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          <Button
            size="small"
            variant="text"
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            startIcon={<ContentCopyIcon fontSize="small" />}
            sx={{ minWidth: 0, p: 0.5 }}
          >
            Copy
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={(e) => { e.stopPropagation(); onSummarize(); }}
            disabled={isSummarizing}
            startIcon={isSummarizing ? <CircularProgress size={12} /> : <AutoFixHighIcon fontSize="small" />}
            sx={{ minWidth: 0, p: 0.5 }}
          >
            {isSummarizing ? '...' : 'Summarize'}
          </Button>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
        <MarkdownBody markdown={finding.content} />
      </AccordionDetails>
    </Accordion>
  );
}

export function AiFindingsBlock() {
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/chat/ai-findings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setFindings(data?.data?.findings ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(findings.map((f) => f.id)));
  }, [findings]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }, []);

  const summarize = useCallback(async (finding: AiFinding) => {
    setSummarizingId(finding.id);
    try {
      const res = await fetch('/api/chat/summarize-finding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: finding.content }),
      });
      const payload = await res.json();
      if (payload.success && payload.data?.summary) {
        // Prepend summary to finding content
        const updated = `**AI Summary:** ${payload.data.summary}\n\n---\n\n${finding.content}`;
        // Save back
        await fetch('/api/chat/ai-findings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: updated, title: finding.title }),
        });
        // Refresh
        const refresh = await fetch('/api/chat/ai-findings');
        const data = await refresh.json();
        setFindings(data?.data?.findings ?? []);
        setExpandedIds((prev) => new Set(prev).add(finding.id));
      }
    } catch {
      // silent
    } finally {
      setSummarizingId(null);
    }
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!findings.length) return null;

  const allExpanded = expandedIds.size === findings.length;

  return (
    <Box component="section" sx={{ mx: 'auto', px: 3, py: 4 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          border: '1px solid',
          borderColor: 'primary.main',
          bgcolor: 'rgba(235, 61, 40, 0.04)',
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 800, color: 'primary.main' }}>
              AI Findings ({findings.length})
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={allExpanded ? collapseAll : expandAll}>
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Button>
            </Stack>
          </Stack>

          {findings.map((finding) => (
            <FindingAccordion
              key={finding.id}
              finding={finding}
              expanded={expandedIds.has(finding.id)}
              onToggle={() => toggleExpand(finding.id)}
              onCopy={() => copyToClipboard(finding.content)}
              onSummarize={() => summarize(finding)}
              isSummarizing={summarizingId === finding.id}
            />
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
