export const DEFAULT_PHASE_ICON = '◇';

export const PHASE_ICON_OPTIONS = [
  '🧠',
  '💡',
  '🧪',
  '🔬',
  '🧬',
  '🧩',
  '🚀',
  '⚡',
  '🔥',
  '⭐',
  '🎯',
  '🧭',
  '📌',
  '📍',
  '🏁',
  '✅',
  '📝',
  '✍️',
  '💬',
  '📚',
  '📖',
  '🗂️',
  '📊',
  '📈',
  '🧮',
  '🔎',
  '🛠️',
  '🧰',
  '⚙️',
  '🧱',
  '🪄',
  '🤖',
  '🌱',
  '🌿',
  '☕',
  '🌙',
  '☀️',
  '🎨',
  '🪐',
  '🔐',
  '🧵',
  '🧲',
  '💎',
  '🏷️',
  '📦',
  '🗃️',
  '🕹️',
  '🎬'
] as const;

export type PhaseIconOption = (typeof PHASE_ICON_OPTIONS)[number];

export function randomPhaseIcon(random: () => number = Math.random): PhaseIconOption {
  const index = Math.min(PHASE_ICON_OPTIONS.length - 1, Math.max(0, Math.floor(random() * PHASE_ICON_OPTIONS.length)));
  return PHASE_ICON_OPTIONS[index];
}
