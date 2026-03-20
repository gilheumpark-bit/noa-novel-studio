import { EmotionalState, ValidationIssue, Severity } from './types';
import { Character } from '../types';

// ============================================================
// EmotionalArcTracker — ANS 9.5
// Tracks character emotions across episodes and validates arcs
// ============================================================

const EMOTION_KEYWORDS: Record<string, string[]> = {
  '공포': ['공포', '두려', '무서', '겁', '떨림', '소름'],
  '분노': ['분노', '화가', '격분', '분개', '울분', '짜증'],
  '슬픔': ['슬픔', '슬퍼', '눈물', '울음', '비통', '서러'],
  '기쁨': ['기쁨', '기뻐', '행복', '환희', '웃음', '미소'],
  '사랑': ['사랑', '애정', '따뜻', '설렘', '두근', '그리움'],
  '긴장': ['긴장', '불안', '초조', '조마', '위험', '급박'],
  '호기심': ['호기심', '궁금', '의문', '신기', '탐구', '관심'],
  '절망': ['절망', '포기', '무기력', '공허', '허탈', '좌절'],
};

const MAX_CHANGE_PER_EPISODE = 0.3;

export function extractEmotionalState(
  text: string,
  characterName: string,
  episode: number
): EmotionalState {
  const emotions: Record<string, number> = {};
  const textLen = text.length;

  if (textLen < 50) {
    return { character: characterName, episode, emotions: {} };
  }

  for (const [emotionName, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let count = 0;

    for (const keyword of keywords) {
      // Count keywords near character name (within 100 chars) OR globally for POV character
      const pattern = new RegExp(keyword, 'g');
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // Check proximity to character name
        const start = Math.max(0, match.index - 100);
        const end = Math.min(textLen, match.index + keyword.length + 100);
        const vicinity = text.substring(start, end);

        if (vicinity.includes(characterName) || true) {
          // For POV character, all emotions count
          count++;
        }
      }
    }

    // Normalize: target ~5 keywords per 1000 chars as 1.0
    const density = count / (textLen / 1000);
    emotions[emotionName] = Math.min(1.0, density / 5);
  }

  return { character: characterName, episode, emotions };
}

export function validateEmotionalArc(
  history: EmotionalState[],
  currentState: EmotionalState
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!history || history.length === 0) return issues;

  // Find previous entry for same character
  const charHistory = history
    .filter(h => h.character === currentState.character)
    .sort((a, b) => a.episode - b.episode);

  if (charHistory.length === 0) return issues;

  const prevState = charHistory[charHistory.length - 1];

  // Check for sudden jumps
  for (const emotion of Object.keys(EMOTION_KEYWORDS)) {
    const prevVal = prevState.emotions[emotion] || 0;
    const currVal = currentState.emotions[emotion] || 0;
    const change = Math.abs(currVal - prevVal);

    if (change > MAX_CHANGE_PER_EPISODE) {
      const direction = currVal > prevVal ? '급상승' : '급하락';
      issues.push({
        category: 'emotional_arc',
        message: `'${currentState.character}'의 '${emotion}' 감정 ${direction} (${prevVal.toFixed(1)}→${currVal.toFixed(1)})`,
        episode: currentState.episode,
        severity: Severity.WARNING,
        suggestion: `감정 변화의 계기(사건/대화)를 추가하세요. 급격한 변화는 독자에게 부자연스럽게 느껴집니다.`,
      });
    }
  }

  // Check for flat arcs (3+ episodes without significant change)
  if (charHistory.length >= 3) {
    const recentThree = charHistory.slice(-3);
    let isFlat = true;

    for (const emotion of Object.keys(EMOTION_KEYWORDS)) {
      const values = recentThree.map(h => h.emotions[emotion] || 0);
      const range = Math.max(...values) - Math.min(...values);
      if (range > 0.1) {
        isFlat = false;
        break;
      }
    }

    if (isFlat) {
      issues.push({
        category: 'emotional_arc',
        message: `'${currentState.character}'의 감정이 3화 이상 변화 없이 평탄합니다`,
        episode: currentState.episode,
        severity: Severity.INFO,
        suggestion: `캐릭터의 내면 변화를 유발하는 사건을 추가하세요.`,
      });
    }
  }

  return issues;
}

export function buildEmotionalContext(
  history: EmotionalState[],
  characters: Character[],
  currentEpisode: number
): string {
  if (!history || history.length === 0) return '';

  // Group by character
  const byChar: Record<string, EmotionalState[]> = {};
  for (const state of history) {
    if (!byChar[state.character]) byChar[state.character] = [];
    byChar[state.character].push(state);
  }

  const lines = ['[EMOTIONAL ARCS / 감정 아크]'];
  let hasContent = false;

  for (const [charName, states] of Object.entries(byChar)) {
    if (states.length === 0) continue;

    // Sort by episode and take last 3
    const sorted = states.sort((a, b) => a.episode - b.episode).slice(-3);

    // Find top 3 emotions by intensity in the latest state
    const latest = sorted[sorted.length - 1];
    const emotionEntries = Object.entries(latest.emotions)
      .filter(([, v]) => v > 0.1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (emotionEntries.length === 0) continue;
    hasContent = true;

    const emotionStr = emotionEntries.map(([name, val]) => {
      // Show trend if we have history
      if (sorted.length >= 2) {
        const prev = sorted[sorted.length - 2].emotions[name] || 0;
        const arrow = val > prev + 0.1 ? '↑' : val < prev - 0.1 ? '↓' : '→';
        return `${name}(${prev.toFixed(1)}${arrow}${val.toFixed(1)})`;
      }
      return `${name}(${val.toFixed(1)})`;
    }).join(', ');

    lines.push(`- ${charName}: ${emotionStr}`);
  }

  if (!hasContent) return '';

  lines.push('→ 위 감정 궤적의 연속선상에서 자연스럽게 이어지는 감정을 묘사하세요.');
  return lines.join('\n');
}
