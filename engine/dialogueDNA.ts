import { FixRecord, FixType, Severity } from './types';
import { Character } from '../types';

// ============================================================
// DialogueDNA — ANS 9.5
// Character dialogue profile validation and directive generation
// ============================================================

// Formal Korean endings
const FORMAL_ENDINGS = /(?:습니다|입니다|ㅂ니다|시죠|하십시오|하시오|세요|십시오)[.!?。]?$/;
// Informal Korean endings
const INFORMAL_ENDINGS = /(?:야|어|아|지|냐|거든|잖아|걸|래|게|뭐|ㅋ|ㅎ)[.!?。]?$/;

// Extract dialogue segments with surrounding context
function extractDialoguesWithContext(text: string): Array<{ dialogue: string; context: string; position: number }> {
  const results: Array<{ dialogue: string; context: string; position: number }> = [];
  const pattern = /["「『"]([^"」』"]+)["」』"]/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const dialogue = match[1];
    const start = Math.max(0, match.index - 30);
    const context = text.substring(start, match.index);
    results.push({ dialogue, context, position: match.index });
  }

  return results;
}

// Try to attribute a dialogue to a character based on surrounding context
function attributeDialogue(context: string, characters: Character[]): Character | null {
  for (const char of characters) {
    if (char.name.length >= 2 && context.includes(char.name)) {
      return char;
    }
  }
  return null;
}

export function validateDialogue(text: string, characters: Character[]): FixRecord[] {
  const fixes: FixRecord[] = [];
  const profiledChars = characters.filter(c => c.dialogueProfile);

  if (profiledChars.length === 0) return fixes;

  const dialogues = extractDialoguesWithContext(text);

  for (const { dialogue, context, position } of dialogues) {
    const char = attributeDialogue(context, profiledChars);
    if (!char || !char.dialogueProfile) continue;

    const profile = char.dialogueProfile;

    // Check formality mismatch
    const sentences = dialogue.split(/[.!?。]+/).filter(s => s.trim());
    if (sentences.length > 0) {
      const lastSentence = sentences[sentences.length - 1].trim();

      if (profile.formality > 0.6) {
        // High formality expected - check for informal endings
        if (INFORMAL_ENDINGS.test(lastSentence) && !FORMAL_ENDINGS.test(lastSentence)) {
          fixes.push({
            fixType: FixType.DIALOGUE,
            original: `"${dialogue.substring(0, 30)}${dialogue.length > 30 ? '...' : ''}"`,
            fixed: `${char.name}의 격식체(${profile.formality.toFixed(1)}) 프로필에 맞게 수정`,
            position,
            reason: `'${char.name}'은(는) 격식체(${profile.formality.toFixed(1)}) 프로필이나 비격식 어미 사용`,
            severity: Severity.WARNING,
          });
        }
      } else if (profile.formality < 0.4) {
        // Low formality expected - check for overly formal endings
        if (FORMAL_ENDINGS.test(lastSentence)) {
          fixes.push({
            fixType: FixType.DIALOGUE,
            original: `"${dialogue.substring(0, 30)}${dialogue.length > 30 ? '...' : ''}"`,
            fixed: `${char.name}의 비격식(${profile.formality.toFixed(1)}) 프로필에 맞게 수정`,
            position,
            reason: `'${char.name}'은(는) 비격식(${profile.formality.toFixed(1)}) 프로필이나 격식 어미 사용`,
            severity: Severity.WARNING,
          });
        }
      }

      // Check sentence length preference
      const avgLen = sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length;
      if (profile.sentenceLength === 'short' && avgLen > 40) {
        fixes.push({
          fixType: FixType.DIALOGUE,
          original: `"${dialogue.substring(0, 30)}..."`,
          fixed: `${char.name}은(는) 짧은 문장 프로필 — 현재 평균 ${Math.round(avgLen)}자`,
          position,
          reason: `'${char.name}'의 대화가 프로필(짧은 문장)보다 길음`,
          severity: Severity.INFO,
        });
      } else if (profile.sentenceLength === 'long' && avgLen < 15 && sentences.length >= 2) {
        fixes.push({
          fixType: FixType.DIALOGUE,
          original: `"${dialogue.substring(0, 30)}..."`,
          fixed: `${char.name}은(는) 긴 문장 프로필 — 현재 평균 ${Math.round(avgLen)}자`,
          position,
          reason: `'${char.name}'의 대화가 프로필(긴 문장)보다 짧음`,
          severity: Severity.INFO,
        });
      }
    }
  }

  return fixes;
}

export function buildDialogueDirective(characters: Character[]): string {
  const profiled = characters.filter(c => c.dialogueProfile);
  if (profiled.length === 0) return '';

  const lines = ['[DIALOGUE DNA / 캐릭터 대화 프로필]'];

  for (const char of profiled) {
    const p = char.dialogueProfile!;
    const lenLabel = p.sentenceLength === 'short' ? '짧은 문장' : p.sentenceLength === 'long' ? '긴 문장' : '보통 문장';
    const formalLabel = p.formality > 0.6 ? '격식체' : p.formality < 0.4 ? '비격식' : '중간';
    const quirksStr = p.quirks.length > 0 ? `, 특징: ${p.quirks.join('/')}` : '';
    lines.push(`- ${char.name}: ${lenLabel}, ${formalLabel}(${p.formality.toFixed(1)}), ${p.speechPattern}, 어미: ${p.endingStyle}${quirksStr}`);
  }

  lines.push('→ 각 캐릭터의 대화는 반드시 위 프로필에 맞게 작성하세요. 모든 캐릭터가 같은 말투를 쓰면 안 됩니다.');

  return lines.join('\n');
}
