'use client';

import { useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import SettingsVoiceIcon from '@mui/icons-material/SettingsVoice';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { TTS_VOICE_PROFILES, type TtsVoiceId } from '@/lib/chat/tts-voices';

const ICON_BUTTON_SX = { width: 48, height: 48 };

interface VoiceProfileMenuProps {
  voice: TtsVoiceId;
  onVoiceChange: (voice: TtsVoiceId) => void;
}

export function VoiceProfileMenu({ voice, onVoiceChange }: VoiceProfileMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const selectedProfile = TTS_VOICE_PROFILES.find((profile) => profile.id === voice);

  return (
    <>
      <Tooltip title={`Voice: ${selectedProfile?.label ?? voice}`}>
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label="Assistant voice profile"
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          aria-controls={open ? 'assistant-voice-menu' : undefined}
          sx={ICON_BUTTON_SX}
        >
          <SettingsVoiceIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="assistant-voice-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: { sx: { minWidth: 240 } },
        }}
      >
        {TTS_VOICE_PROFILES.map((profile) => (
          <MenuItem
            key={profile.id}
            selected={profile.id === voice}
            onClick={() => {
              onVoiceChange(profile.id);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {profile.id === voice ? <CheckIcon fontSize="small" /> : null}
            </ListItemIcon>
            <ListItemText
              primary={profile.label}
              secondary={profile.description}
              slotProps={{
                secondary: { variant: 'caption' },
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
