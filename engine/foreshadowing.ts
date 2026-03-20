import { Foreshadowing, ValidationIssue, Severity } from './types';
import { calculateForeshadowWeight } from './models';

// ============================================================
// ForeshadowingTracker — ANS 9.5
// Validates and generates directives for foreshadowing management
// ============================================================

export function validateForeshadowings(
  foreshadowings: Foreshadowing[],
  currentEpisode: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!foreshadowings || foreshadowings.length === 0) return issues;

  for (const f of foreshadowings) {
    if (f.resolved) continue;

    // Overdue: expected payoff has passed
    if (f.expectedPayoffEpisode < currentEpisode) {
      issues.push({
        category: 'foreshadowing',
        message: `미회수 복선 기한 초과: "${f.content.substring(0, 25)}..." (EP.${f.plantedEpisode}→EP.${f.expectedPayoffEpisode})`,
        episode: currentEpisode,
        severity: Severity.ERROR,
        suggestion: `이번 화에서 복선을 회수하거나, 회수 시점을 연장하세요.`,
      });
    }
    // Due soon: within 2 episodes
    else if (f.expectedPayoffEpisode <= currentEpisode + 2) {
      const weight = calculateForeshadowWeight(
        f.plantedEpisode, currentEpisode, f.expectedPayoffEpisode, f.importance
      );
      issues.push({
        category: 'foreshadowing',
        message: `복선 회수 임박 [가중치 ${weight.toFixed(2)}]: "${f.content.substring(0, 25)}..." (EP.${f.expectedPayoffEpisode} 회수 예정)`,
        episode: currentEpisode,
        severity: Severity.WARNING,
        suggestion: `${f.expectedPayoffEpisode - currentEpisode}화 내에 회수가 필요합니다.`,
      });
    }
  }

  return issues;
}

export function buildForeshadowingDirective(
  foreshadowings: Foreshadowing[],
  currentEpisode: number
): string {
  if (!foreshadowings || foreshadowings.length === 0) return '';

  const active = foreshadowings.filter(f => !f.resolved);
  if (active.length === 0) return '';

  const lines = ['[ACTIVE FORESHADOWINGS / 활성 복선]'];

  // Sort by weight (urgency) descending
  const withWeight = active.map(f => ({
    f,
    weight: calculateForeshadowWeight(
      f.plantedEpisode, currentEpisode, f.expectedPayoffEpisode, f.importance
    ),
  }));
  withWeight.sort((a, b) => b.weight - a.weight);

  for (const { f, weight } of withWeight) {
    const overdue = f.expectedPayoffEpisode < currentEpisode;
    const urgentTag = overdue ? ' [기한초과!]' : (f.expectedPayoffEpisode <= currentEpisode + 2 ? ' [긴급]' : '');
    lines.push(`- [가중치: ${weight.toFixed(2)}] EP.${f.plantedEpisode}에 심은 복선: "${f.content}" → EP.${f.expectedPayoffEpisode} 회수 예정${urgentTag}`);
  }

  lines.push('→ 가중치가 높은 복선을 서사에 자연스럽게 배치하거나 회수하세요.');

  return lines.join('\n');
}
