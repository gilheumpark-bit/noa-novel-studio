import { callAgentAI } from '../../services/agentService';
import { AgentRole, AgentStatus, AgentOutput, AgentContext, CharacterArcState, CharacterArcStore, EMPTY_ARC_STORE, extractFirstJSON } from './types';

// ============================================================
// Character Arc & Acting Agent (캐릭 아크 연기 에이전트)
// ============================================================
// Responsibilities:
// 1. PRE-GEN: Provide character arc state and acting directions
// 2. POST-GEN: Update character arc progression
// 3. Ensure character voice consistency and growth trajectory
// ============================================================

const CHARACTER_SYSTEM_PROMPT = `당신은 소설의 캐릭터 연출가(Character Director)입니다. 당신의 역할:

1. 각 캐릭터의 성장 아크(arc)를 추적합니다.
2. 캐릭터별 "연기 지시(acting direction)"를 제공합니다.
3. 이번 에피소드에서 각 캐릭터가 보여야 할 감정, 태도, 행동 변화를 지시합니다.
4. 캐릭터 간 관계 다이나믹을 관리합니다.

성장 단계:
- setup: 캐릭터 소개, 일상 묘사
- catalyst: 변화를 촉발하는 사건 경험
- struggle: 내적/외적 갈등과 저항
- transformation: 핵심적 변화의 순간
- resolution: 변화 완성 또는 비극적 귀결

응답 형식 (JSON):
{
  "actingDirections": [
    {
      "character": "캐릭터 이름",
      "currentStage": "setup|catalyst|struggle|transformation|resolution",
      "arcProgress": 0-100,
      "direction": "이번 에피소드의 연기 지시",
      "emotionalTone": "감정 톤 키워드",
      "internalConflict": "내면 갈등",
      "keyBehavior": "이번 에피소드에서 보여야 할 핵심 행동/태도"
    }
  ],
  "relationshipDynamics": ["캐릭터 간 관계 연출 지시"],
  "narrativeDirective": "캐릭터 관점의 서사 지시"
}`;

const ARC_UPDATE_PROMPT = `당신은 소설의 캐릭터 아크 분석가입니다. 생성된 텍스트를 읽고 각 캐릭터의 아크 진행 상태를 업데이트하세요.

응답 형식 (JSON array):
[
  {
    "characterName": "캐릭터 이름",
    "currentGoal": "현재 목표",
    "internalConflict": "내면 갈등",
    "growthStage": "setup|catalyst|struggle|transformation|resolution",
    "keyMoments": ["이번 에피소드의 핵심 순간들"],
    "voiceNotes": "다음 에피소드를 위한 연기 노트",
    "arcProgress": 0-100
  }
]`;

export async function runCharacterAgent(
  ctx: AgentContext,
  arcStore: CharacterArcStore,
): Promise<AgentOutput> {
  const start = performance.now();

  try {
    if (ctx.config.characters.length === 0) {
      return {
        role: AgentRole.CHARACTER,
        status: AgentStatus.DONE,
        content: '등록된 캐릭터 없음.',
        directive: '',
        durationMs: Math.round(performance.now() - start),
      };
    }

    const characters = ctx.config.characters
      .map(c => {
        const arc = arcStore.arcs.find(a => a.characterName === c.name);
        const profile = c.dialogueProfile
          ? `말투: ${c.dialogueProfile.speechPattern}, 어미: ${c.dialogueProfile.endingStyle}`
          : '';
        const arcInfo = arc
          ? `현재 단계: ${arc.growthStage} (${arc.arcProgress}%), 목표: ${arc.currentGoal}, 갈등: ${arc.internalConflict}, 연기노트: ${arc.voiceNotes}`
          : '아크 미설정';
        return `${c.name} (${c.role}): ${c.traits}. DNA: ${c.dna}. ${profile}. 아크: ${arcInfo}`;
      })
      .join('\n');

    const emotionalHistory = (ctx.config.emotionalHistory || [])
      .filter(e => e.episode >= ctx.config.episode - 3)
      .map(e => `EP.${e.episode} ${e.character}: ${Object.entries(e.emotions).map(([k, v]) => `${k}(${v.toFixed(2)})`).join(', ')}`)
      .join('\n');

    const narrativeProgress = ctx.config.totalEpisodes > 0 ? ctx.config.episode / ctx.config.totalEpisodes : 0;

    const userPrompt = `에피소드: ${ctx.config.episode} / ${ctx.config.totalEpisodes} (서사 진행률: ${Math.round(narrativeProgress * 100)}%)
장르: ${ctx.config.genre}
시점 캐릭터: ${ctx.config.povCharacter}
사용자 지시: ${ctx.draft}

[캐릭터 목록 + 아크 상태]
${characters}

[최근 감정 이력]
${emotionalHistory || '없음'}

각 캐릭터의 연기 지시와 관계 다이나믹을 제공하세요. 서사 진행률에 맞는 아크 단계를 고려하세요.`;

    const response = await callAgentAI({
      systemPrompt: CHARACTER_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1536,
      temperature: 0.5,
      signal: ctx.config._agentSignal as AbortSignal | undefined,
    });

    let directive = '';
    let content = response;
    try {
      const jsonMatch = extractFirstJSON(response);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch);
        const parts: string[] = [];

        if (parsed.actingDirections?.length) {
          parts.push('캐릭터 연기 지시:');
          for (const dir of parsed.actingDirections) {
            parts.push(`[${dir.character}] (${dir.currentStage}, ${dir.arcProgress}%)`);
            parts.push(`  연출: ${dir.direction}`);
            parts.push(`  감정 톤: ${dir.emotionalTone}`);
            parts.push(`  핵심 행동: ${dir.keyBehavior}`);
          }
        }
        if (parsed.relationshipDynamics?.length) {
          parts.push('\n관계 다이나믹:');
          for (const r of parsed.relationshipDynamics) {
            parts.push(`- ${r}`);
          }
        }
        if (parsed.narrativeDirective) {
          parts.push(`\n서사 지시: ${parsed.narrativeDirective}`);
        }

        directive = parts.join('\n');
        content = `캐릭터 연출 완료. ${parsed.actingDirections?.length || 0}명 연기 지시 생성.`;
      }
    } catch {
      directive = response.slice(0, 500);
    }

    return {
      role: AgentRole.CHARACTER,
      status: AgentStatus.DONE,
      content,
      directive: directive ? `[CHARACTER ACTING DIRECTIVE]\n${directive}` : '',
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error: any) {
    return {
      role: AgentRole.CHARACTER,
      status: AgentStatus.ERROR,
      content: `캐릭터 에이전트 오류: ${error.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}

export async function updateCharacterArcs(
  generatedText: string,
  ctx: AgentContext,
  currentStore: CharacterArcStore,
): Promise<CharacterArcStore> {
  try {
    if (ctx.config.characters.length === 0) return currentStore;

    const characters = ctx.config.characters.map(c => c.name).join(', ');
    const currentArcs = currentStore.arcs
      .map(a => `${a.characterName}: ${a.growthStage} (${a.arcProgress}%), 목표: ${a.currentGoal}`)
      .join('\n');

    const userPrompt = `에피소드 ${ctx.config.episode} 텍스트:
${generatedText.slice(0, 3000)}

등장 캐릭터: ${characters}
서사 진행률: ${Math.round((ctx.config.episode / (ctx.config.totalEpisodes || 1)) * 100)}%

[현재 아크 상태]
${currentArcs || '초기 상태'}

각 캐릭터의 아크를 업데이트하세요.`;

    const response = await callAgentAI({
      systemPrompt: ARC_UPDATE_PROMPT,
      userPrompt,
      maxTokens: 1024,
      temperature: 0.3,
      signal: ctx.config._agentSignal as AbortSignal | undefined,
    });

    const jsonMatch = extractFirstJSON(response, '[');
    if (!jsonMatch) return currentStore;

    let items: any[];
    try {
      items = JSON.parse(jsonMatch);
    } catch {
      console.warn('[CharacterAgent] Failed to parse extracted JSON');
      return currentStore;
    }
    const newArcs: CharacterArcState[] = items
      .filter(item => item.characterName)
      .map(item => ({
        characterName: item.characterName,
        currentGoal: item.currentGoal || '',
        internalConflict: item.internalConflict || '',
        growthStage: item.growthStage || 'setup',
        keyMoments: item.keyMoments || [],
        voiceNotes: item.voiceNotes || '',
        arcProgress: Math.min(100, Math.max(0, item.arcProgress || 0)),
      }));

    // Merge: update existing arcs, add new ones
    const merged = [...currentStore.arcs];
    for (const newArc of newArcs) {
      const idx = merged.findIndex(a => a.characterName === newArc.characterName);
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          ...newArc,
          keyMoments: [...merged[idx].keyMoments, ...newArc.keyMoments].slice(-10),
        };
      } else {
        merged.push(newArc);
      }
    }

    return {
      arcs: merged,
      lastUpdatedEpisode: ctx.config.episode,
    };
  } catch {
    return currentStore;
  }
}
