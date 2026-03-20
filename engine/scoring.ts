import { StoryConfig, AppLanguage } from '../types';
import { EngineReport, PlatformType, getActFromEpisode } from './types';
import { tensionCurve, predictEngagement } from './models';
import { validateGeneratedContent } from './validator';
import { calculateByteSize, getTargetByteRange } from './serialization';
import { analyzeEOSFailure } from './eosFeedback';

// ============================================================
// EOS (Emotion OK Signal) — Ported from ANS 9.2
// ============================================================

const EMOTION_KEYWORDS_KO = [
  '눈물', '미소', '웃음', '울음', '분노', '공포', '두려움', '사랑',
  '그리움', '외로', '행복', '슬픔', '절망', '희망', '고통', '환희',
  '떨림', '심장', '숨', '눈빛', '목소리', '손끝', '가슴',
];

const SENSORY_KEYWORDS_KO = [
  '냄새', '소리', '빛', '어둠', '차가', '뜨거', '부드러',
  '거친', '달콤', '쓴', '축축', '바람', '울림', '진동',
];

// Pre-compiled regexes for performance
const EMOTION_REGEXES = EMOTION_KEYWORDS_KO.map(kw => new RegExp(kw, 'g'));
const SENSORY_REGEXES = SENSORY_KEYWORDS_KO.map(kw => new RegExp(kw, 'g'));

export function calculateEOSScore(text: string): number {
  if (!text || text.length < 100) return 0;

  const sentences = text.split(/[.!?。]+/).filter(s => s.trim()).length || 1;

  // Emotional keyword density
  let emotionCount = 0;
  for (const re of EMOTION_REGEXES) {
    re.lastIndex = 0;
    const matches = text.match(re);
    if (matches) emotionCount += matches.length;
  }

  // Sensory description density
  let sensoryCount = 0;
  for (const re of SENSORY_REGEXES) {
    re.lastIndex = 0;
    const matches = text.match(re);
    if (matches) sensoryCount += matches.length;
  }

  // Dialogue ratio (lines in quotes)
  const dialogueMatches = text.match(/["「『"][^"」』"]*["」』"]/g) || [];
  const dialogueRatio = dialogueMatches.length / sentences;

  // Internal monologue markers
  const monologueMarkers = (text.match(/[—…]/g) || []).length;

  // Weighted score
  const emotionDensity = Math.min(1, emotionCount / (sentences * 0.5));
  const sensoryDensity = Math.min(1, sensoryCount / (sentences * 0.3));
  const dialogueScore = Math.min(1, dialogueRatio * 2);
  const monologueScore = Math.min(1, monologueMarkers / (sentences * 0.2));

  const rawScore =
    emotionDensity * 35 +
    sensoryDensity * 25 +
    dialogueScore * 25 +
    monologueScore * 15;

  return Math.round(Math.min(100, Math.max(0, rawScore)));
}

// ============================================================
// Grade Calculator — Ported from ANS 9.3
// ============================================================

export function calculateGrade(avgScore: number): string {
  if (avgScore >= 95) return 'S++';
  if (avgScore >= 90) return 'S+';
  if (avgScore >= 85) return 'S';
  if (avgScore >= 80) return 'A+';
  if (avgScore >= 75) return 'A';
  if (avgScore >= 70) return 'B+';
  if (avgScore >= 65) return 'B';
  if (avgScore >= 55) return 'C+';
  return 'C';
}

// ============================================================
// Metrics Analysis
// ============================================================

export function analyzeMetrics(
  text: string,
  config: StoryConfig
): { tension: number; pacing: number; immersion: number } {
  if (!text || text.length < 50) {
    return { tension: 0, pacing: 0, immersion: 0 };
  }

  const sentences = text.split(/[.!?。]+/).filter(s => s.trim());
  const sentenceCount = sentences.length || 1;

  // Tension: keyword density + short sentence ratio
  const tensionKeywords = ['위험', '급', '갑자기', '폭발', '비명', '긴장', '전투', '충돌', 'danger', 'explosion', 'scream'];
  let tensionHits = 0;
  for (const kw of tensionKeywords) {
    const re = new RegExp(kw, 'gi');
    tensionHits += (text.match(re) || []).length;
  }
  const shortSentenceRatio = sentences.filter(s => s.trim().length < 20).length / sentenceCount;
  const tension = Math.min(100, Math.round(
    (tensionHits / sentenceCount) * 200 + shortSentenceRatio * 50
  ));

  // Pacing: sentence length variance (good pacing = high variance)
  const lengths = sentences.map(s => s.trim().length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / sentenceCount;
  const variance = lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / sentenceCount;
  const stdDev = Math.sqrt(variance);
  const pacing = Math.min(100, Math.round(Math.min(1, stdDev / 30) * 80 + 20));

  // Immersion: dialogue + sensory + engagement prediction
  const dialogueCount = (text.match(/["「『"][^"」』"]*["」』"]/g) || []).length;
  const dialogueRatio = dialogueCount / sentenceCount;
  const eosScore = calculateEOSScore(text);

  const engagement = predictEngagement({
    dialogue: dialogueRatio,
    action: tensionHits / sentenceCount,
    tension: tension / 100,
    mystery: 0.5,
    emotion: eosScore / 100,
    pacing: pacing / 100,
  });

  const immersion = Math.min(100, Math.round(engagement * 100));

  return { tension, pacing, immersion };
}

// ============================================================
// Full Engine Report
// ============================================================

export function generateEngineReport(
  text: string,
  config: StoryConfig,
  language: AppLanguage,
  platform: PlatformType = PlatformType.MOBILE
): EngineReport {
  const startTime = performance.now();

  const totalEpisodes = config.totalEpisodes ?? 25;
  const actPosition = getActFromEpisode(config.episode, totalEpisodes);
  const tensionTarget = Math.round(tensionCurve(config.episode, totalEpisodes, config.genre) * 100);

  const metrics = analyzeMetrics(text, config);
  const eosScore = calculateEOSScore(text);
  // validateGeneratedContent already calls validateAITone internally for KO
  const { fixes, issues, aiToneScore } = validateGeneratedContent(text, language, config);

  // EOS failure analysis — record for prompt feedback in next generation
  const eosFailure = analyzeEOSFailure(eosScore, text, config.episode);
  if (eosFailure) {
    issues.push({
      category: 'eos_feedback',
      message: `EOS 점수 미달 (${eosScore}/40): ${eosFailure.flags.join(', ')}`,
      episode: config.episode,
      severity: eosFailure.flags.includes('emotion-explained') ? 2 : 1,
      suggestion: '다음 생성 시 피드백이 자동 반영됩니다.',
    });
  }

  const byteSize = calculateByteSize(text);
  const targetRange = getTargetByteRange(platform);

  const avgScore = (metrics.tension + metrics.pacing + metrics.immersion + eosScore) / 4;
  const grade = calculateGrade(avgScore);

  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    version: '10.0',
    grade,
    eosScore,
    tensionTarget,
    actPosition,
    metrics,
    aiTonePercent: aiToneScore,
    serialization: {
      platform,
      byteSize,
      targetRange,
      withinRange: byteSize >= targetRange.min && byteSize <= targetRange.max,
    },
    fixes,
    issues,
    processingTimeMs,
  };
}
