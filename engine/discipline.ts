import { ValidationIssue, Severity } from './types';

// ============================================================
// DisciplineEngine — ANS 9.5 금지 규칙 엔진
// 8가지 anti-pattern 감지 (정규식 기반)
// ============================================================

interface DisciplineRule {
  name: string;
  nameEN: string;
  pattern: RegExp;
  severity: Severity;
  suggestion: string;
  suggestionEN: string;
}

const DISCIPLINE_RULES: DisciplineRule[] = [
  {
    name: '메타 태그',
    nameEN: 'Meta Tag',
    pattern: /\((?:Sensory|감각|Action|Emotion|System):.*?\)/g,
    severity: Severity.CRITICAL,
    suggestion: '메타 태그를 제거하고 서사에 자연스럽게 녹이세요.',
    suggestionEN: 'Remove meta tags and weave the content naturally into the narrative.',
  },
  {
    name: '감정 명명',
    nameEN: 'Emotion Naming',
    pattern: /(?:분노|슬픔|기쁨|두려움|사랑|외로움|공포|불안|절망|행복)(?:를|을|이|에)?\s*느꼈다/g,
    severity: Severity.ERROR,
    suggestion: '감정을 직접 명명하지 말고 감각/행동으로 보여주세요 (Show, Don\'t Tell).',
    suggestionEN: 'Don\'t name emotions directly. Show through senses and actions.',
  },
  {
    name: '세계관 요약',
    nameEN: 'Worldbuilding Summary',
    pattern: /이\s*세계에서는|이\s*세상에서는|이곳에서는\s*모든/g,
    severity: Severity.WARNING,
    suggestion: '세계관을 요약하지 말고 캐릭터의 경험을 통해 자연스럽게 드러내세요.',
    suggestionEN: 'Don\'t summarize worldbuilding. Reveal it through character experience.',
  },
  {
    name: '철학적 결론',
    nameEN: 'Philosophical Conclusion',
    pattern: /이것이\s*(?:진정한|참된|진짜|궁극의)|결국\s*(?:진정한|진짜)\s*[가-힣]+[은는이가]/g,
    severity: Severity.WARNING,
    suggestion: '작가가 결론을 내리지 마세요. 독자가 스스로 해석하게 하세요.',
    suggestionEN: 'Don\'t draw philosophical conclusions. Let the reader interpret.',
  },
  {
    name: '빌런 해설',
    nameEN: 'Villain Exposition',
    pattern: /내가\s*이렇게\s*된\s*이유는|내\s*계획을?\s*말해\s*주[겠지]|모든\s*것을?\s*설명해\s*주[겠지]/g,
    severity: Severity.WARNING,
    suggestion: '빌런의 동기를 직접 해설하지 말고 행동과 과거 장면으로 보여주세요.',
    suggestionEN: 'Don\'t have villains explain their motives. Show through actions and flashbacks.',
  },
  {
    name: '시스템 로그 남용',
    nameEN: 'System Log Abuse',
    pattern: /\[(?:SYSTEM|시스템)\].*?(?:감정|마음|느낌|심리)/g,
    severity: Severity.ERROR,
    suggestion: '시스템 메시지에 감정 정보를 포함하지 마세요. 시스템은 데이터만 표시합니다.',
    suggestionEN: 'System logs should not contain emotional information.',
  },
  {
    name: '미학 단독 문장',
    nameEN: 'Aesthetic Sentence',
    pattern: /^(?:그것이|이것이)\s*(?:진정한|진짜|참된)\s*[가-힣]+(?:이었다|였다)[.。]$/gm,
    severity: Severity.INFO,
    suggestion: '독립적인 미학 선언 문장을 피하세요. 서사 속에서 의미가 드러나야 합니다.',
    suggestionEN: 'Avoid standalone aesthetic declarations. Meaning should emerge from narrative.',
  },
  {
    name: '독자 예지',
    nameEN: 'Reader Anticipation',
    pattern: /[가-힣]+[은는]\s*(?:아직\s*)?(?:알지|모르고|알\s*수)\s*(?:못했다|없었다|있었을까)/g,
    severity: Severity.WARNING,
    suggestion: '화자가 독자에게 미래를 암시하지 마세요. 현재 시점에 집중하세요.',
    suggestionEN: 'Don\'t foreshadow to the reader through narrator omniscience.',
  },
];

export function validateDiscipline(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of DISCIPLINE_RULES) {
    rule.pattern.lastIndex = 0;
    const matches = text.match(rule.pattern);
    if (matches) {
      for (const match of matches) {
        issues.push({
          category: 'discipline',
          message: `[${rule.name}] "${match.substring(0, 30)}${match.length > 30 ? '...' : ''}"`,
          severity: rule.severity,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  return issues;
}
