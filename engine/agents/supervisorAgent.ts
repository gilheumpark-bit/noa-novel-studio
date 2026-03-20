import { callAgentAI } from '../../services/agentService';
import { StoryConfig, Character } from '../../types';
import { Severity, POVType, WorldFact, WorldRule } from '../types';

// ============================================================
// Supervisor Agent (감독 에이전트)
// ============================================================
// Two-layer architecture:
//   Layer A: Regex Watchdog — runs on every chunk, zero cost, zero latency
//   Layer B: AI Checkpoint — runs every ~1000 chars, 1 API call
//
// The supervisor monitors the writing agent's streaming output
// and feeds corrections back in real-time.
// ============================================================

// ============================================================
// Alert Types
// ============================================================

export interface SupervisorAlert {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion: string;
  position: number;    // char offset in accumulated text
  matchedText: string; // the offending snippet
}

export interface CheckpointResult {
  alerts: SupervisorAlert[];
  directive: string;   // correction directive to inject
  eosEstimate: number; // estimated EOS score so far
  tensionLevel: string; // 'low' | 'on-target' | 'high'
  shouldIntervene: boolean;
}

export interface SupervisorState {
  alerts: SupervisorAlert[];
  checkpoints: CheckpointResult[];
  totalChunksProcessed: number;
  lastCheckpointAt: number; // char position
  isActive: boolean;
}

export function createSupervisorState(): SupervisorState {
  return {
    alerts: [],
    checkpoints: [],
    totalChunksProcessed: 0,
    lastCheckpointAt: 0,
    isActive: true,
  };
}

// ============================================================
// LAYER A: Regex Watchdog (runs on every chunk accumulation)
// ============================================================
// Absorbs from: discipline.ts, povManager.ts, worldConsistency.ts,
//               eosFeedback.ts (pattern detection)
// Cost: 0 API calls, <1ms per check
// ============================================================

// ── Discipline anti-patterns (from discipline.ts) ──
const WATCHDOG_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  suggestion: string;
}> = [
  {
    name: '메타 태그',
    pattern: /\((?:Sensory|감각|Action|Emotion|System):.*?\)/g,
    severity: 'critical',
    category: 'discipline',
    suggestion: '메타 태그 제거 → 서사에 자연스럽게 녹이세요.',
  },
  {
    name: '감정 직접 명명',
    pattern: /(?:분노|슬픔|기쁨|두려움|사랑|외로움|공포|불안|절망|행복)(?:를|을|이|에)?\s*느꼈다/g,
    severity: 'warning',
    category: 'discipline',
    suggestion: '감정을 명명하지 말고 감각/행동으로 (예: "두려웠다"→"손끝이 차가워졌다")',
  },
  {
    name: '세계관 요약',
    pattern: /이\s*세계에서는|이\s*세상에서는|이곳에서는\s*모든/g,
    severity: 'warning',
    category: 'discipline',
    suggestion: '요약 금지 → 캐릭터 경험으로 세계관 드러내기',
  },
  {
    name: '철학적 결론',
    pattern: /이것이\s*(?:진정한|참된|진짜|궁극의)|결국\s*(?:진정한|진짜)\s*[가-힣]+[은는이가]/g,
    severity: 'warning',
    category: 'discipline',
    suggestion: '작가가 결론 내리지 말것 → 독자가 해석하게',
  },
  {
    name: '빌런 해설',
    pattern: /내가\s*이렇게\s*된\s*이유는|내\s*계획을?\s*말해\s*주[겠지]|모든\s*것을?\s*설명해\s*주[겠지]/g,
    severity: 'warning',
    category: 'discipline',
    suggestion: '동기 해설 금지 → 행동과 플래시백으로',
  },
  {
    name: '시스템 로그 감정',
    pattern: /\[(?:SYSTEM|시스템)\].*?(?:감정|마음|느낌|심리)/g,
    severity: 'critical',
    category: 'discipline',
    suggestion: '시스템 로그에 감정 정보 금지',
  },
  {
    name: '독자 예지',
    pattern: /[가-힣]+[은는]\s*(?:아직\s*)?(?:알지|모르고|알\s*수)\s*(?:못했다|없었다|있었을까)/g,
    severity: 'warning',
    category: 'discipline',
    suggestion: '화자의 미래 암시 금지 → 현재 시점 집중',
  },

  // ── EOS failure patterns (from eosFeedback.ts) ──
  {
    name: '감정 직접 서술',
    pattern: /감정[이가]?\s*(?:느껴졌다|밀려왔다|휩싸였다)/g,
    severity: 'warning',
    category: 'eos',
    suggestion: '감정을 직접 서술 → 신체 반응으로 대체',
  },
  {
    name: '조기 감정 해소',
    pattern: /마음[을를]?\s*(?:다잡았다|가라앉혔다|추스렸다)/g,
    severity: 'warning',
    category: 'eos',
    suggestion: '감정 해소를 미루세요 → 미해결 긴장 유지',
  },
  {
    name: '긴장 해제',
    pattern: /(?:이제|드디어)\s*(?:괜찮|안전|안정)|안도[의를]?\s*(?:한숨|숨)/g,
    severity: 'info',
    category: 'eos',
    suggestion: '안도감 조기 표출 주의 → 불안 요소 유지',
  },

  // ── AI Tone patterns ──
  {
    name: 'AI톤 접속사',
    pattern: /(?:^|\.\s*)(?:그러나|반면에|한편으로는|따라서|그러므로)\s*[,]?\s*/gm,
    severity: 'info',
    category: 'ai_tone',
    suggestion: 'AI 특유의 접속사 → 삭제하거나 자연스러운 연결로',
  },
];

// ── POV leak patterns (from povManager.ts) ──
const INNER_THOUGHT_VERBS = [
  '생각했다', '느꼈다', '깨달았다', '이해했다', '두려워했다',
  '기뻐했다', '슬퍼했다', '후회했다', '결심했다', '의심했다',
  '확신했다', '걱정했다', '기대했다', '짐작했다',
];

// ── Dead character detection (from worldConsistency.ts) ──
const DEATH_KEYWORDS = ['사망', '죽었', '죽음', '전사', '사라졌', '소멸'];
const ALIVE_VERBS = /[은는이가]\s*(?:말했다|대답했다|외쳤다|소리쳤다|달렸다|걸었다|웃었다|움직였다|나타났다|등장했다|싸웠다|공격했다)/;

// ── EOS density keywords (from scoring.ts) ──
const EMOTION_KW = ['눈물', '미소', '웃음', '울음', '분노', '공포', '두려움', '사랑', '그리움', '외로', '행복', '슬픔', '절망', '희망', '고통'];
const SENSORY_KW = ['냄새', '소리', '빛', '어둠', '차가', '뜨거', '부드러', '거친', '달콤', '쓴', '축축', '바람'];

/**
 * Layer A: Regex Watchdog
 * Runs on the full accumulated text each time a chunk arrives.
 * Only scans the NEW portion since last scan to avoid re-alerting.
 */
export function runWatchdog(
  fullText: string,
  lastScannedLength: number,
  config: StoryConfig,
): { alerts: SupervisorAlert[]; scannedUpTo: number } {
  const alerts: SupervisorAlert[] = [];
  const newText = fullText.substring(lastScannedLength);

  if (newText.length < 10) {
    return { alerts, scannedUpTo: lastScannedLength };
  }

  // ── Run discipline + EOS + AI tone patterns ──
  for (const rule of WATCHDOG_PATTERNS) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(newText)) !== null) {
      alerts.push({
        type: rule.severity,
        category: rule.category,
        message: `[${rule.name}] "${match[0].substring(0, 40)}"`,
        suggestion: rule.suggestion,
        position: lastScannedLength + match.index,
        matchedText: match[0],
      });
    }
  }

  // ── POV leak detection ──
  if (config.povCharacter && config.povType &&
      config.povType !== POVType.THIRD_OMNISCIENT &&
      config.povType !== POVType.MULTIPLE) {
    const otherChars = config.characters
      .map(c => c.name)
      .filter(n => n !== config.povCharacter && n.length >= 2);

    for (const verb of INNER_THOUGHT_VERBS) {
      const pattern = new RegExp(`([가-힣]{2,6})[은는이가]\\s*${verb}`, 'g');
      let match;
      while ((match = pattern.exec(newText)) !== null) {
        const subject = match[1];
        if (subject === config.povCharacter) continue;
        if (['그', '그녀', '나'].includes(subject)) continue;

        const isKnown = otherChars.some(n => subject.includes(n) || n.includes(subject));
        const isLikelyName = /^[가-힣]{2,4}$/.test(subject);

        if (isKnown || isLikelyName) {
          alerts.push({
            type: 'warning',
            category: 'pov_leak',
            message: `시점 누수: '${subject}'의 내면 묘사 (${config.povCharacter} 시점)`,
            suggestion: `'${subject}'의 외부 행동/표정으로 대체하세요`,
            position: lastScannedLength + match.index,
            matchedText: match[0],
          });
        }
      }
    }
  }

  // ── Dead character reappearance ──
  const deadChars = extractDeadCharacters(config.worldFacts || []);
  for (const charName of deadChars) {
    const fullPattern = new RegExp(charName + ALIVE_VERBS.source, 'g');
    let match;
    while ((match = fullPattern.exec(newText)) !== null) {
      // Skip if flashback context
      const contextStart = Math.max(0, match.index - 50);
      const context = newText.substring(contextStart, match.index);
      if (/회상|과거|기억|그때|예전/.test(context)) continue;

      alerts.push({
        type: 'critical',
        category: 'world_consistency',
        message: `사망한 '${charName}'가 행동 중!`,
        suggestion: `이 캐릭터는 이전 에피소드에서 사망했습니다. 회상 처리 필요.`,
        position: lastScannedLength + match.index,
        matchedText: match[0],
      });
    }
  }

  return { alerts, scannedUpTo: fullText.length };
}

function extractDeadCharacters(worldFacts: WorldFact[]): string[] {
  const names: string[] = [];
  for (const fact of worldFacts) {
    if (!fact.isPermanent) continue;
    if (!DEATH_KEYWORDS.some(kw => fact.content.includes(kw))) continue;
    const nameMatch = fact.content.match(/^([가-힣]{2,4})/);
    if (nameMatch) names.push(nameMatch[1]);
  }
  return names;
}

// ============================================================
// LAYER B: AI Checkpoint (runs every ~1000 chars)
// ============================================================
// Makes 1 API call to evaluate:
// - EOS density mid-check
// - Tension curve drift
// - Foreshadowing payoff opportunities
// - Overall narrative quality mid-stream
// Cost: ~0.5K input + ~0.3K output per checkpoint
// ============================================================

const CHECKPOINT_SYSTEM_PROMPT = `당신은 실시간 소설 감독관(Narrative Supervisor)입니다. 집필 중인 텍스트를 실시간으로 모니터링합니다.

역할:
1. EOS 감정 밀도 중간 점검 (감정/감각 키워드 충분한가)
2. 긴장도 드리프트 감지 (목표 긴장도 대비 현재 방향)
3. 복선 회수 기회 감지 (현재 장면에서 자연스럽게 회수 가능한 복선)
4. 서사 일관성 종합 판단

응답 형식 (JSON, 반드시 이 형식):
{
  "eosEstimate": 0-100,
  "tensionLevel": "low|on-target|high",
  "shouldIntervene": true/false,
  "issues": [
    {"type": "warning", "message": "문제 설명", "suggestion": "교정 지시"}
  ],
  "directive": "집필 에이전트에게 전달할 교정 지시문 (없으면 빈 문자열)"
}

중요: 문제가 없으면 shouldIntervene: false, directive: "" 으로 응답하세요.
불필요한 개입은 집필 흐름을 방해합니다. 명확한 문제가 있을 때만 개입하세요.`;

export async function runCheckpoint(
  accumulatedText: string,
  config: StoryConfig,
  targetTension: number,
  watchdogAlerts: SupervisorAlert[],
  signal?: AbortSignal,
): Promise<CheckpointResult> {
  try {
    // Quick local EOS estimate (no API needed for this)
    const localEos = quickEOSEstimate(accumulatedText);

    // If local checks look fine and no watchdog alerts, skip API call
    const criticalAlerts = watchdogAlerts.filter(a => a.type === 'critical');
    if (localEos >= 35 && criticalAlerts.length === 0) {
      return {
        alerts: [],
        directive: '',
        eosEstimate: localEos,
        tensionLevel: 'on-target',
        shouldIntervene: false,
      };
    }

    // Build checkpoint context
    const foreshadowings = (config.foreshadowings || [])
      .filter(f => !f.resolved && f.expectedPayoffEpisode <= config.episode + 2)
      .map(f => `[EP.${f.plantedEpisode}→${f.expectedPayoffEpisode}] ${f.content} (중요도: ${f.importance})`)
      .join('\n');

    const recentAlerts = watchdogAlerts.slice(-5)
      .map(a => `[${a.type}] ${a.message}`)
      .join('\n');

    const userPrompt = `에피소드 ${config.episode}, 목표 긴장도: ${targetTension}%
현재까지 생성된 텍스트 (${accumulatedText.length}자):
---
${accumulatedText.slice(-2000)}
---

[로컬 EOS 추정치: ${localEos}]
[감시 경고 ${watchdogAlerts.length}건]
${recentAlerts || '없음'}

[회수 가능 복선]
${foreshadowings || '없음'}

위 텍스트의 현재 상태를 평가하고, 교정이 필요하면 지시를 제공하세요.`;

    const response = await callAgentAI({
      systemPrompt: CHECKPOINT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 512,
      temperature: 0.2,
      signal,
    });

    // Parse response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const alerts: SupervisorAlert[] = (parsed.issues || []).map((issue: any, i: number) => ({
        type: issue.type || 'warning',
        category: 'checkpoint',
        message: issue.message || '',
        suggestion: issue.suggestion || '',
        position: accumulatedText.length,
        matchedText: '',
      }));

      return {
        alerts,
        directive: parsed.directive || '',
        eosEstimate: parsed.eosEstimate ?? localEos,
        tensionLevel: parsed.tensionLevel || 'on-target',
        shouldIntervene: parsed.shouldIntervene ?? false,
      };
    }

    return {
      alerts: [],
      directive: '',
      eosEstimate: localEos,
      tensionLevel: 'on-target',
      shouldIntervene: false,
    };
  } catch (error) {
    // On error, return non-interventional result
    return {
      alerts: [],
      directive: '',
      eosEstimate: quickEOSEstimate(accumulatedText),
      tensionLevel: 'on-target',
      shouldIntervene: false,
    };
  }
}

/**
 * Quick local EOS estimate without API call.
 * Simplified version of scoring.ts calculateEOSScore()
 */
function quickEOSEstimate(text: string): number {
  if (!text || text.length < 100) return 0;

  const sentences = text.split(/[.!?。]+/).filter(s => s.trim()).length || 1;

  let emotionCount = 0;
  for (const kw of EMOTION_KW) {
    const matches = text.match(new RegExp(kw, 'g'));
    if (matches) emotionCount += matches.length;
  }

  let sensoryCount = 0;
  for (const kw of SENSORY_KW) {
    const matches = text.match(new RegExp(kw, 'g'));
    if (matches) sensoryCount += matches.length;
  }

  const dialogueCount = (text.match(/["「『"][^"」』"]*["」』"]/g) || []).length;
  const dialogueRatio = dialogueCount / sentences;
  const monologueMarkers = (text.match(/[—…]/g) || []).length;

  const emotionDensity = Math.min(1, emotionCount / (sentences * 0.5));
  const sensoryDensity = Math.min(1, sensoryCount / (sentences * 0.3));
  const dialogueScore = Math.min(1, dialogueRatio * 2);
  const monologueScore = Math.min(1, monologueMarkers / (sentences * 0.2));

  const raw = emotionDensity * 35 + sensoryDensity * 25 + dialogueScore * 25 + monologueScore * 15;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

// ============================================================
// Checkpoint Interval Configuration
// ============================================================

export const CHECKPOINT_INTERVAL = 1000; // chars between AI checkpoints
export const MIN_TEXT_FOR_CHECKPOINT = 500; // minimum text before first checkpoint
