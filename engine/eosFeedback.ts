import { EOSHistoryEntry } from './types';

// ============================================================
// EOS Feedback Loop — ANS 9.5
// Analyzes EOS failures and generates prompt directives
// for the next generation cycle (no re-generation)
// ============================================================

// Patterns indicating emotion was directly explained (bad)
const EMOTION_EXPLAINED_PATTERNS = [
  /(?:분노|슬픔|기쁨|두려움|공포|불안|절망|외로움)(?:를|을|이|에)?\s*느꼈다/g,
  /감정[이가]?\s*(?:느껴졌다|밀려왔다|휩싸였다)/g,
  /마음[이가]?\s*(?:무거웠다|아팠다|흔들렸다)/g,
  /(?:생각했다|깨달았다|이해했다|알았다)/g,
];

// Patterns indicating premature emotional closure (bad)
const PREMATURE_CLOSURE_PATTERNS = [
  /마음[을를]?\s*(?:다잡았다|가라앉혔다|추스렸다)/g,
  /(?:이제|드디어)\s*(?:괜찮|안전|안정)/g,
  /안도[의를]?\s*(?:한숨|숨)/g,
  /(?:긴장|불안)[이가]?\s*(?:풀렸다|가셨다|사라졌다)/g,
  /모든\s*것[이가]?\s*끝났다/g,
];

// Check if tension drops in the second half of the text
function detectPressureDrop(text: string): boolean {
  const mid = Math.floor(text.length / 2);
  const firstHalf = text.substring(0, mid);
  const secondHalf = text.substring(mid);

  const tensionKeywords = ['위험', '급', '빨리', '서둘', '긴장', '전투', '충돌', '폭발', '비명'];

  let firstCount = 0;
  let secondCount = 0;
  for (const kw of tensionKeywords) {
    firstCount += (firstHalf.match(new RegExp(kw, 'g')) || []).length;
    secondCount += (secondHalf.match(new RegExp(kw, 'g')) || []).length;
  }

  // Pressure drop: first half has significantly more tension than second half
  return firstCount >= 3 && secondCount <= firstCount * 0.3;
}

export function analyzeEOSFailure(
  eosScore: number,
  text: string,
  episode: number,
  threshold: number = 40
): EOSHistoryEntry | null {
  if (eosScore >= threshold) return null;

  const flags: string[] = [];

  // Check emotion-explained
  for (const pattern of EMOTION_EXPLAINED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      flags.push('emotion-explained');
      break;
    }
  }

  // Check premature-closure
  for (const pattern of PREMATURE_CLOSURE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      flags.push('premature-closure');
      break;
    }
  }

  // Check pressure-drop
  if (detectPressureDrop(text)) {
    flags.push('pressure-drop');
  }

  // If no specific flags but score is low, mark as generic low-emotion
  if (flags.length === 0) {
    flags.push('low-emotional-density');
  }

  return { score: eosScore, flags, episode };
}

const FLAG_DIRECTIVES_KO: Record<string, string> = {
  'emotion-explained': '이전 생성에서 감정을 직접 서술했습니다. 감정을 명명하지 말고 감각과 행동으로 전달하세요. (예: "두려웠다" → "손끝이 차가워졌다")',
  'premature-closure': '이전 생성에서 긴장이 조기에 해소되었습니다. 감정적 해소를 미루고, 미해결 상태를 유지하세요.',
  'pressure-drop': '이전 생성에서 후반부 긴장도가 급감했습니다. 텍스트 후반부에도 위기감과 미스터리를 유지하세요.',
  'low-emotional-density': '이전 생성의 감정 밀도가 낮았습니다. 감각 묘사(냄새, 소리, 촉감)와 내면 독백을 강화하세요.',
};

const FLAG_DIRECTIVES_EN: Record<string, string> = {
  'emotion-explained': 'Previous generation directly stated emotions. Show through senses and actions instead of naming.',
  'premature-closure': 'Previous generation resolved tension too early. Keep emotional states unresolved longer.',
  'pressure-drop': 'Previous generation lost tension in the second half. Maintain crisis and mystery throughout.',
  'low-emotional-density': 'Previous generation had low emotional density. Add sensory details and internal monologue.',
};

export function buildEOSFeedbackDirective(eosHistory: EOSHistoryEntry[], isKO: boolean = true): string {
  if (!eosHistory || eosHistory.length === 0) return '';

  const recent = eosHistory.slice(-3);
  const directives = isKO ? FLAG_DIRECTIVES_KO : FLAG_DIRECTIVES_EN;
  const allFlags = new Set<string>();
  for (const entry of recent) {
    for (const flag of entry.flags) {
      allFlags.add(flag);
    }
  }

  if (allFlags.size === 0) return '';

  const header = isKO
    ? '[EOS 피드백 — 이전 생성 품질 개선 지침]'
    : '[EOS FEEDBACK — Quality Improvement Directives]';

  const lines = [header];
  for (const flag of allFlags) {
    const directive = directives[flag];
    if (directive) {
      lines.push(`- ${directive}`);
    }
  }

  return lines.join('\n');
}
