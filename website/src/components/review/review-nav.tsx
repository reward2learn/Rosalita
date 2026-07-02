'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  getReviewPartDisplayTitle,
  listReviewParts,
  tierAllowsAccess,
  type AuthTier,
} from '@/lib/page-catalog';
import { useAppSelector } from '@/store/hooks';

const TOUCH_TARGET = { minHeight: 48 };
const PART_SELECT_LABEL = 'Jump between review sections';

export function ReviewNav({ currentSlug }: { currentSlug: string }) {
  const router = useRouter();
  const tier = useAppSelector((s) => s.auth.tier);
  const parts = listReviewParts().filter((part) => tierAllowsAccess(tier, part.authTier));

  const handlePartChange = (partSlug: string) => {
    router.push(`/review/${partSlug}` as Route);
  };

  return (
    <Box
      component="nav"
      aria-label="Business review parts"
      sx={{
        width: { xs: '100%', md: 260 },
        flexShrink: 0,
        px: { xs: 3, md: 0 },
        py: { xs: 2, md: 4 },
        position: { md: 'sticky' },
        top: { md: 72 },
        alignSelf: 'flex-start',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.03)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
            Parts A–O
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {tierAllowsAccess(tier, 'google' as AuthTier)
              ? PART_SELECT_LABEL
              : 'Sign in with Google for full review access'}
          </Typography>
        </Box>

        <Box sx={{ display: { xs: 'block', md: 'none' }, p: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="review-part-select-label">{PART_SELECT_LABEL}</InputLabel>
            <Select
              labelId="review-part-select-label"
              id="review-part-select"
              value={currentSlug}
              label={PART_SELECT_LABEL}
              onChange={(event) => handlePartChange(event.target.value)}
              inputProps={{ 'aria-label': PART_SELECT_LABEL }}
            >
              {parts.map((part) => (
                <MenuItem key={part.partSlug} value={part.partSlug}>
                  {getReviewPartDisplayTitle(part.title)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <List dense disablePadding sx={{ display: { xs: 'none', md: 'block' } }}>
          {parts.map((part) => {
            const href = `/review/${part.partSlug}` as Route;
            const selected = part.partSlug === currentSlug;
            const displayTitle = getReviewPartDisplayTitle(part.title);

            return (
              <ListItemButton
                key={part.partSlug}
                component={Link}
                href={href}
                selected={selected}
                sx={{
                  ...TOUCH_TARGET,
                  borderLeft: '3px solid transparent',
                  '&.Mui-selected': {
                    borderLeftColor: 'primary.main',
                    bgcolor: 'rgba(235, 61, 40, 0.08)',
                  },
                }}
              >
                <Tooltip title={displayTitle} placement="right" enterDelay={500}>
                  <ListItemText
                    primary={displayTitle}
                    slotProps={{
                      primary: {
                        variant: 'body2',
                        sx: {
                          fontWeight: selected ? 700 : 600,
                          whiteSpace: 'normal',
                          lineHeight: 1.35,
                        },
                      },
                    }}
                  />
                </Tooltip>
              </ListItemButton>
            );
          })}
        </List>
      </Paper>
    </Box>
  );
}
