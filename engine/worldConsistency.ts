import { WorldRule, WorldFact, ValidationIssue, Severity } from './types';

// ============================================================
// WorldConsistencyEngine — ANS 9.5
// Validates text against world rules and established facts
// ============================================================

const DEATH_KEYWORDS = ['사망', '죽었', '죽음', '전사', '사라졌', '소멸'];
const ALIVE_ACTION_PATTERNS = [
  /[은는이가]\s*(?:말했다|대답했다|외쳤다|소리쳤다|달렸다|걸었다|웃었다)/,
  /[은는이가]\s*(?:움직였다|나타났다|등장했다|싸웠다|공격했다)/,
];
const FLASHBACK_KEYWORDS = ['회상', '과거', '기억', '그때', '예전'];

const MEDIEVAL_BANNED = ['컴퓨터', '스마트폰', '핸드폰', '인터넷', '자동차', '비행기', '전화', 'AI', '로봇', '드론'];
const MAGIC_KEYWORDS = ['마법', '주문', '마나', '소환', '텔레포트', '순간이동', '마력', '정령', '저주'];

export function validateWorldConsistency(
  text: string,
  worldRules: WorldRule[],
  worldFacts: WorldFact[],
  currentEpisode: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if ((!worldRules || worldRules.length === 0) && (!worldFacts || worldFacts.length === 0)) {
    return issues;
  }

  // 1. Dead character reappearance check
  if (worldFacts) {
    for (const fact of worldFacts) {
      if (!fact.isPermanent) continue;
      // Check if this fact describes a character death
      const isDeath = DEATH_KEYWORDS.some(kw => fact.content.includes(kw));
      if (!isDeath) continue;

      // Extract character name from fact (first 2-4 char Korean name)
      const nameMatch = fact.content.match(/^([가-힣]{2,4})/);
      if (!nameMatch) continue;
      const charName = nameMatch[1];

      for (const pattern of ALIVE_ACTION_PATTERNS) {
        const fullPattern = new RegExp(charName + pattern.source, 'g');
        let match;
        while ((match = fullPattern.exec(text)) !== null) {
          // Check if the match is within a flashback context (within 200 chars)
          const start = Math.max(0, match.index - 200);
          const end = Math.min(text.length, match.index + match[0].length + 200);
          const vicinity = text.substring(start, end);
          const isFlashback = FLASHBACK_KEYWORDS.some(kw => vicinity.includes(kw));
          if (isFlashback) continue;

          issues.push({
            category: 'world_consistency',
            message: `사망한 캐릭터 '${charName}'가 행동하고 있습니다`,
            episode: currentEpisode,
            severity: Severity.CRITICAL,
            suggestion: `'${charName}'는 EP.${fact.episodeEstablished}에서 사망했습니다. 회상 장면으로 처리하거나 삭제하세요.`,
          });
          break;
        }
      }
    }
  }

  // 2. World rule violation checks
  if (worldRules) {
    for (const rule of worldRules) {
      if (rule.category === 'technology') {
        // Check for medieval tech violations
        if (rule.description.includes('중세') || rule.description.includes('medieval')) {
          for (const tech of MEDIEVAL_BANNED) {
            if (text.includes(tech)) {
              issues.push({
                category: 'world_consistency',
                message: `기술 수준 위반: '${tech}'는 이 세계관에 맞지 않습니다`,
                episode: currentEpisode,
                severity: Severity.ERROR,
                suggestion: `세계관 규칙: "${rule.description}"`,
              });
            }
          }
        }
      }

      if (rule.category === 'magic') {
        // Check for magic in non-magic worlds
        if (rule.description.includes('없') || rule.description.includes('금지') || rule.description.includes('no magic')) {
          for (const kw of MAGIC_KEYWORDS) {
            if (text.includes(kw)) {
              issues.push({
                category: 'world_consistency',
                message: `마법 체계 위반: '${kw}' 표현이 발견되었습니다`,
                episode: currentEpisode,
                severity: Severity.ERROR,
                suggestion: `세계관 규칙: "${rule.description}"`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

export function buildWorldDirective(
  worldRules: WorldRule[],
  worldFacts: WorldFact[]
): string {
  const hasRules = worldRules && worldRules.length > 0;
  const hasFacts = worldFacts && worldFacts.length > 0;
  if (!hasRules && !hasFacts) return '';

  const lines: string[] = [];

  if (hasRules) {
    lines.push('[WORLD RULES / 세계관 규칙]');
    for (const rule of worldRules) {
      lines.push(`- [${rule.category}] ${rule.description}`);
    }
  }

  if (hasFacts) {
    lines.push('');
    lines.push('[ESTABLISHED FACTS / 확정 사실]');
    for (const fact of worldFacts) {
      const tag = fact.isPermanent ? 'permanent' : 'temporary';
      lines.push(`- [EP.${fact.episodeEstablished}, ${tag}] ${fact.content}`);
    }
  }

  lines.push('→ 위 규칙과 사실에 모순되는 내용을 생성하지 마세요.');

  return lines.join('\n');
}
