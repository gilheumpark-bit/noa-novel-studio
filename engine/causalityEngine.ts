import { CausalityLevel } from '../types';
import { FixRecord, FixType, Severity, ValidationIssue } from './types';

// ============================================================
// Causality Engine — 범용 인과율 엔진 (5-Level System)
// ============================================================

// --- Banned Words (all levels) ---
const BANNED_WORDS = ['기적', '운명', '갑자기', '그냥', '원래'];

// --- Level Definitions ---

export interface CausalityLevelDef {
  name: { KO: string; EN: string };
  description: { KO: string; EN: string };
  /** Max allowed emotion description ratio (0-1) */
  emotionCap: number;
  /** Whether 3rd person is forced in crisis */
  forcedThirdInCrisis: boolean;
  /** Whether 1st person is blocked entirely */
  firstPersonBlocked: boolean;
  /** Proxy cost acceptance rate (0-1) */
  proxyCostRate: number;
  /** Whether glitch text effects are enabled */
  glitchEnabled: boolean;
  /** Cost grades required on gains */
  costGrades: CostGrade[];
}

export interface CostGrade {
  grade: number;
  name: { KO: string; EN: string };
  description: { KO: string; EN: string };
}

const LEVEL_DEFS: Record<CausalityLevel, CausalityLevelDef> = {
  1: {
    name: { KO: '입문', EN: 'Starter' },
    description: { KO: '라이트 로맨스, 일상물', EN: 'Light romance, slice-of-life' },
    emotionCap: 1.0,
    forcedThirdInCrisis: false,
    firstPersonBlocked: false,
    proxyCostRate: 1.0,
    glitchEnabled: false,
    costGrades: [],
  },
  2: {
    name: { KO: '표준', EN: 'Standard' },
    description: { KO: '판타지, 로맨스 판타지', EN: 'Fantasy, romance fantasy' },
    emotionCap: 0.7,
    forcedThirdInCrisis: false,
    firstPersonBlocked: false,
    proxyCostRate: 0.5,
    glitchEnabled: false,
    costGrades: [],
  },
  3: {
    name: { KO: '중간', EN: 'Medium' },
    description: { KO: 'SF, 성장물, 전쟁물', EN: 'Sci-fi, coming-of-age, war' },
    emotionCap: 0.5,
    forcedThirdInCrisis: true,
    firstPersonBlocked: false,
    proxyCostRate: 0.5,
    glitchEnabled: false,
    costGrades: [
      { grade: 1, name: { KO: '관계/신뢰 손상', EN: 'Relationship damage' }, description: { KO: '중간 이득 획득 시', EN: 'On medium gain' } },
      { grade: 2, name: { KO: '체력/감각 일시 손상', EN: 'Temporary physical damage' }, description: { KO: '전투/무리한 행동 시', EN: 'On combat/overexertion' } },
      { grade: 3, name: { KO: '정보/기억 일부 손실', EN: 'Partial memory/info loss' }, description: { KO: '고급 정보 획득 시', EN: 'On high-value intel gain' } },
    ],
  },
  4: {
    name: { KO: '하드', EN: 'Hard' },
    description: { KO: '다크 판타지, 스릴러, 디스토피아', EN: 'Dark fantasy, thriller, dystopia' },
    emotionCap: 0.3,
    forcedThirdInCrisis: true,
    firstPersonBlocked: false,
    proxyCostRate: 0.3,
    glitchEnabled: true,
    costGrades: [
      { grade: 1, name: { KO: '영구적 신체 손상', EN: 'Permanent physical damage' }, description: { KO: '대형 이득 시', EN: 'On major gain' } },
      { grade: 2, name: { KO: '관계 영구 절단', EN: 'Permanent relationship severance' }, description: { KO: '중요 정보 획득 시', EN: 'On critical intel gain' } },
      { grade: 3, name: { KO: '감정 일부 마비', EN: 'Partial emotional numbness' }, description: { KO: '반복 위기 돌파 시', EN: 'On repeated crisis breakthrough' } },
      { grade: 4, name: { KO: '일시적 감각 손실', EN: 'Temporary sensory loss' }, description: { KO: '소형 이득 시', EN: 'On minor gain' } },
    ],
  },
  5: {
    name: { KO: '익스트림', EN: 'Extreme' },
    description: { KO: '극한 인과율 / EH 원본', EN: 'Extreme causality / EH original' },
    emotionCap: 1.0, // Dynamically adjusted by EH score
    forcedThirdInCrisis: true,
    firstPersonBlocked: false, // Dynamically adjusted by EH score
    proxyCostRate: 0.5,
    glitchEnabled: true,
    costGrades: [
      { grade: 1, name: { KO: '수명 단축', EN: 'Lifespan reduction' }, description: { KO: '-25 ~ -50p', EN: '-25 ~ -50p' } },
      { grade: 2, name: { KO: '감각 영구 소실', EN: 'Permanent sensory loss' }, description: { KO: '-18 ~ -35p', EN: '-18 ~ -35p' } },
      { grade: 3, name: { KO: '기억/관계 절단', EN: 'Memory/relationship severance' }, description: { KO: '-12 ~ -25p', EN: '-12 ~ -25p' } },
      { grade: 4, name: { KO: '감정 마비', EN: 'Emotional numbness' }, description: { KO: '-5 ~ -11p', EN: '-5 ~ -11p' } },
    ],
  },
};

export function getCausalityLevelDef(level: CausalityLevel): CausalityLevelDef {
  return LEVEL_DEFS[level];
}

export function getAllLevelDefs(): Record<CausalityLevel, CausalityLevelDef> {
  return LEVEL_DEFS;
}

// ============================================================
// EH Score → Style Lock (Level 5 only)
// ============================================================

export interface EHStyleLock {
  allowFirstPerson: boolean;
  emotionCap: number;
  styleLabel: { KO: string; EN: string };
}

export function getEHStyleLock(ehScore: number): EHStyleLock {
  if (ehScore >= 50) {
    return { allowFirstPerson: true, emotionCap: 1.0, styleLabel: { KO: '자유 서술', EN: 'Free narration' } };
  } else if (ehScore >= 35) {
    return { allowFirstPerson: false, emotionCap: 0.3, styleLabel: { KO: '3인칭 위주 / 감정 30%', EN: '3rd person / Emotion 30%' } };
  } else if (ehScore >= 10) {
    return { allowFirstPerson: false, emotionCap: 0.0, styleLabel: { KO: '3인칭 강제 / 감정 0%', EN: '3rd person forced / Emotion 0%' } };
  } else {
    return { allowFirstPerson: false, emotionCap: 0.0, styleLabel: { KO: '기계적 기록', EN: 'Mechanical record' } };
  }
}

// ============================================================
// System Prompt Directive Builder
// ============================================================

export function buildCausalityDirective(
  level: CausalityLevel,
  ehScore?: number,
  isKO: boolean = true
): string {
  const def = LEVEL_DEFS[level];
  const lines: string[] = [];

  lines.push(`[CAUSALITY ENGINE — LEVEL ${level}: ${isKO ? def.name.KO : def.name.EN}]`);

  // Banned words
  lines.push(`금지어: ${BANNED_WORDS.join(' / ')} → 위반 시 반드시 논리적 인과관계로 대체`);

  // Cost grades
  if (def.costGrades.length > 0) {
    lines.push('');
    lines.push('[대가 정산 등급]');
    for (const cg of def.costGrades) {
      lines.push(`  ${cg.grade}등급 | ${isKO ? cg.name.KO : cg.name.EN} | ${isKO ? cg.description.KO : cg.description.EN}`);
    }
    lines.push(`  Proxy Cost: 타인 희생으로 얻은 이득 → 인정률 ${Math.round(def.proxyCostRate * 100)}%`);
  } else if (level === 1) {
    lines.push('주인공 이득 발생 시 → 소소한 손실 1개 삽입 필수 (피로, 오해, 시간 소모 등)');
  }

  // Style restrictions
  if (level >= 3) {
    lines.push('');
    lines.push('[서술 제한]');
    if (level === 5 && ehScore !== undefined) {
      const lock = getEHStyleLock(ehScore);
      lines.push(`  현재 EH: ${ehScore.toFixed(2)}p → ${isKO ? lock.styleLabel.KO : lock.styleLabel.EN}`);
      if (!lock.allowFirstPerson) lines.push('  1인칭 시점 차단');
      lines.push(`  감정 묘사 상한: ${Math.round(lock.emotionCap * 100)}%`);
      if (ehScore <= 0) {
        lines.push('  ⚠ SYSTEM CRASH: 주인공 자격 박탈 — 집필 강제 중단 경고');
      }
    } else {
      lines.push(`  위기 구간 → ${def.forcedThirdInCrisis ? '3인칭 강제' : '3인칭 비율 30% 이상 권장'}`);
      lines.push(`  감정 묘사 상한: ${Math.round(def.emotionCap * 100)}%`);
    }
  }

  // Glitch
  if (def.glitchEnabled) {
    lines.push('');
    lines.push('[글리치 트리거]');
    lines.push('  가면 수치와 실제 EH 괴리 임계 초과 시 → 텍스트 내 [Process: Success] 또는 깨진 글자(E̸r̸r̸o̸r̸) 삽입 허용');
  }

  // Level 5 special
  if (level === 5) {
    lines.push('');
    lines.push('[제0전제]');
    lines.push('"저들도 사람이다. 그래서 용서받지 못한다."');
  }

  return lines.join('\n');
}

// ============================================================
// Post-Generation Validator
// ============================================================

export function validateCausality(
  text: string,
  level: CausalityLevel,
  ehScore?: number
): { fixes: FixRecord[]; issues: ValidationIssue[] } {
  const fixes: FixRecord[] = [];
  const issues: ValidationIssue[] = [];

  // 1. Banned word detection (all levels)
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      fixes.push({
        fixType: FixType.DISCIPLINE,
        original: word,
        fixed: '',
        position: match.index,
        reason: `인과율 금지어: "${word}" — 논리적 인과관계로 대체 필요`,
        severity: level >= 4 ? Severity.ERROR : Severity.WARNING,
      });
    }
  }

  // 2. Level 5 EH style lock validation
  if (level === 5 && ehScore !== undefined) {
    const lock = getEHStyleLock(ehScore);

    // Check 1st person usage when blocked
    if (!lock.allowFirstPerson) {
      const firstPersonPatterns = /[나내저제]는\s|[나내저제]의\s|[나내]가\s/g;
      let match;
      while ((match = firstPersonPatterns.exec(text)) !== null) {
        issues.push({
          category: 'causality',
          message: `EH ${ehScore.toFixed(1)}p — 1인칭 서술 금지 구간에서 "${match[0].trim()}" 사용 감지`,
          severity: Severity.ERROR,
          suggestion: '3인칭으로 전환하세요',
        });
        break; // Report once
      }
    }

    // Check emotion density when capped
    if (lock.emotionCap < 1.0) {
      const emotionWords = ['느꼈다', '슬펐다', '기뻤다', '두려웠다', '사랑했다', '미워했다',
        '행복했다', '불안했다', '화났다', '감동했다', '외로웠다', '그리웠다'];
      let emotionCount = 0;
      for (const ew of emotionWords) {
        const matches = text.match(new RegExp(ew, 'g'));
        if (matches) emotionCount += matches.length;
      }
      const sentences = text.split(/[.!?。]+/).filter(s => s.trim()).length || 1;
      const ratio = emotionCount / sentences;
      if (ratio > lock.emotionCap * 0.3) {
        issues.push({
          category: 'causality',
          message: `EH ${ehScore.toFixed(1)}p — 감정 묘사 밀도 ${(ratio * 100).toFixed(0)}%가 상한 ${Math.round(lock.emotionCap * 100)}%를 초과`,
          severity: Severity.WARNING,
          suggestion: '감정 직접 서술을 줄이고 행동/감각으로 대체하세요',
        });
      }
    }

    // System crash warning
    if (ehScore <= 0) {
      issues.push({
        category: 'causality',
        message: 'SYSTEM CRASH: EH = 0 — 주인공 자격 박탈. 집필 강제 중단 권고',
        severity: Severity.CRITICAL,
      });
    }
  }

  return { fixes, issues };
}
