import { FixRecord, FixType, Severity, POVType } from './types';
import { Character } from '../types';

// ============================================================
// POVManager — ANS 9.5
// Detects POV leaks in third-person limited / first-person narratives
// ============================================================

// Inner-thought verbs that only the POV character should use
const INNER_THOUGHT_VERBS = [
  '생각했다', '느꼈다', '깨달았다', '이해했다', '두려워했다',
  '기뻐했다', '슬퍼했다', '후회했다', '결심했다', '의심했다',
  '확신했다', '걱정했다', '기대했다', '짐작했다',
];

// Show-Don't-Tell alternatives for POV leaks
const SHOW_ALTERNATIVES: Record<string, string[]> = {
  '느꼈다': ['손끝이 차가워졌다', '숨이 거칠어졌다', '어깨가 굳었다'],
  '생각했다': ['눈이 가늘어졌다', '입술을 깨물었다', '손가락이 멈췄다'],
  '깨달았다': ['눈이 커졌다', '숨을 삼켰다', '동작이 멈췄다'],
  '두려워했다': ['뒷목에 소름이 돋았다', '마른침을 삼켰다', '손이 떨렸다'],
  '기뻐했다': ['입꼬리가 올라갔다', '어깨가 펴졌다', '발걸음이 가벼워졌다'],
  '슬퍼했다': ['눈동자가 떨렸다', '시선이 바닥을 향했다', '목소리가 가라앉았다'],
  '후회했다': ['주먹을 꽉 쥐었다', '눈을 감았다', '한숨이 새어나왔다'],
  '걱정했다': ['손을 만지작거렸다', '시선이 흔들렸다', '숨이 얕아졌다'],
};

export function validatePOV(
  text: string,
  povCharacter: string,
  povType: POVType,
  characters: Character[]
): FixRecord[] {
  const fixes: FixRecord[] = [];

  // Only validate for limited POV types
  if (povType === POVType.THIRD_OMNISCIENT || povType === POVType.MULTIPLE) {
    return fixes;
  }

  if (!povCharacter || povCharacter.trim() === '') {
    return fixes;
  }

  // Build set of known character names (excluding POV character)
  const otherCharNames = characters
    .map(c => c.name)
    .filter(name => name !== povCharacter && name.length >= 2);

  for (const verb of INNER_THOUGHT_VERBS) {
    // Pattern: [character name][은는이가] [verb]
    const pattern = new RegExp(`([가-힣]{2,6})[은는이가]\\s*${verb}`, 'g');
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const subject = match[1];

      // Skip if subject is the POV character
      if (subject === povCharacter) continue;

      // Skip generic pronouns that might refer to POV character
      if (['그', '그녀', '나'].includes(subject)) continue;

      // Check if this subject is a known character OR matches Korean name pattern
      const isKnownChar = otherCharNames.some(name => subject.includes(name) || name.includes(subject));
      const isLikelyName = /^[가-힣]{2,4}$/.test(subject);

      if (isKnownChar || isLikelyName) {
        const alternatives = SHOW_ALTERNATIVES[verb] || ['외부 행동/표정으로 표현하세요'];
        const suggestion = alternatives[0];

        fixes.push({
          fixType: FixType.POV,
          original: match[0],
          fixed: `${subject}의 ${suggestion}`,
          position: match.index,
          reason: `시점 누수: '${povCharacter}' 시점에서 '${subject}'의 내면 묘사 불가 → "${suggestion}"`,
          severity: Severity.ERROR,
        });
      }
    }
  }

  return fixes;
}
