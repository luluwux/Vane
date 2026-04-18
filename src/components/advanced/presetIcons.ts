import {
  Diamond, Swords, Shield, Zap,
  Mic, Puzzle, Flame, Gamepad2, Rocket, Ghost
} from 'lucide-react';
import React from 'react';

export const PresetIcons: Record<string, React.FC<any>> = {
  'default': Diamond,
  'aggressive-ttl': Swords,
  'standard-split': Shield,
  'youtube-quic': Zap,
  'discord-voip': Mic,
  'deep-fragmentation': Puzzle,
  'heavy-censorship': Flame,
  'lightweight-gaming': Gamepad2,
  'oob-advanced': Rocket,
  'https-sni-ghost': Ghost,
};
