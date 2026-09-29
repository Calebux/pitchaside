import { PlayerShell } from '@/components/player-shell';

export default function PlayerAppLayout({ children }: { children: React.ReactNode }) {
  return <PlayerShell>{children}</PlayerShell>;
}
