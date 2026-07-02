'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  changeDirection?: 'up' | 'down' | 'neutral';
  active?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  change,
  changeDirection = 'neutral',
  active = false,
  onClick,
}: MetricCardProps) {
  const changeColor =
    changeDirection === 'up'
      ? 'secondary.main'
      : changeDirection === 'down'
        ? 'primary.main'
        : 'text.secondary';

  return (
    <Paper
      component={onClick ? 'button' : 'div'}
      onClick={onClick}
      elevation={0}
      sx={{
        p: 2.5,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        border: '1px solid',
        borderColor: active ? 'primary.main' : 'divider',
        bgcolor: active ? 'rgba(235, 61, 40, 0.06)' : 'rgba(255,255,255,0.03)',
        boxShadow: active ? (theme) => `0 0 0 1px ${theme.palette.primary.main}` : 'none',
        transition: 'all 0.25s ease',
        width: '100%',
        '&:hover': onClick
          ? {
              bgcolor: 'rgba(235, 61, 40, 0.04)',
              borderColor: 'rgba(235, 61, 40, 0.2)',
              transform: 'translateY(-2px)',
            }
          : undefined,
      }}
    >
      <Typography
        variant="h5"
        component="p"
        sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.2 }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 0.75,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'text.secondary',
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      {change ? (
        <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: '0.68rem', color: changeColor }}>
          {change}
        </Box>
      ) : null}
    </Paper>
  );
}
