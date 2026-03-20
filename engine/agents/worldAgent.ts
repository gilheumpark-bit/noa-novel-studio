import { callAgentAI } from '../../services/agentService';
import { AgentRole, AgentStatus, AgentOutput, AgentContext } from './types';

// ============================================================
// Worldbuilding Agent (세계관 에이전트)
// ============================================================
// Responsibilities:
// 1. PRE-GEN: Validate world consistency, provide world state context
// 2. Enforce world rules, physics, magic systems
// 3. Detect anachronisms and setting violations
// ============================================================

const WORLD_SYSTEM_PROMPT = `당신은 소설의 세계관 감독관(World Supervisor)입니다. 당신의 역할:

1. 세계관의 내적 일관성을 보장합니다.
2. 물리 법칙, 마법 체계, 사회 구조의 규칙을 감시합니다.
3. 이전 에피소드에서 확립된 사실과 모순되는 요소를 감지합니다.
4. 현재 에피소드의 시공간적 맥락을 명확히 합니다.

검증 항목:
- 죽은 캐릭터가 다시 등장하지 않는가?
- 기술 수준에 맞지 않는 도구/개념이 등장하지 않는가?
- 지리적/시간적 연속성이 유지되는가?
- 마법/능력의 대가 구조가 지켜지는가?

응답 형식 (JSON):
{
  "worldState": "현재 세계 상태 요약",
  "activeRules": ["이번 에피소드에서 특히 주의할 세계 규칙"],
  "constraints": ["집필 시 반드시 지켜야 할 제약 조건"],
  "warnings": ["잠재적 모순 경고"],
  "spatioTemporal": "시간과 장소 컨텍스트"
}`;

export async function runWorldAgent(ctx: AgentContext): Promise<AgentOutput> {
  const start = performance.now();

  try {
    const worldRules = (ctx.config.worldRules || [])
      .map(r => `[${r.category}] ${r.description}`)
      .join('\n');

    const worldFacts = (ctx.config.worldFacts || [])
      .map(f => `[EP.${f.episodeEstablished}, ${f.isPermanent ? '영구' : '임시'}] ${f.content}`)
      .join('\n');

    const characters = ctx.config.characters
      .map(c => `${c.name} (${c.role}): ${c.traits}`)
      .join('\n');

    const userPrompt = `현재 에피소드: ${ctx.config.episode} / ${ctx.config.totalEpisodes}
장르: ${ctx.config.genre}
배경: ${ctx.config.setting}
시놉시스: ${ctx.config.synopsis || '없음'}

[등장 캐릭터]
${characters || '없음'}

[세계관 규칙]
${worldRules || '정의된 규칙 없음'}

[확정 사실]
${worldFacts || '확정 사실 없음'}

[사용자 지시]
${ctx.draft}

이번 에피소드 집필을 위한 세계관 컨텍스트와 제약 조건을 제공하세요.`;

    const response = await callAgentAI({
      systemPrompt: WORLD_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
      temperature: 0.3,
      signal: ctx.config._agentSignal as AbortSignal | undefined,
    });

    let directive = '';
    let content = response;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const parts: string[] = [];
        if (parsed.worldState) parts.push(`세계 상태: ${parsed.worldState}`);
        if (parsed.spatioTemporal) parts.push(`시공간: ${parsed.spatioTemporal}`);
        if (parsed.activeRules?.length) parts.push(`활성 규칙:\n${parsed.activeRules.map((r: string) => `- ${r}`).join('\n')}`);
        if (parsed.constraints?.length) parts.push(`제약 조건:\n${parsed.constraints.map((c: string) => `- ${c}`).join('\n')}`);
        directive = parts.join('\n');

        const warningCount = parsed.warnings?.length || 0;
        content = `세계관 검증 완료. ${parsed.activeRules?.length || 0}개 규칙 활성, ${warningCount}개 경고.`;
        if (warningCount > 0) {
          content += ` 경고: ${parsed.warnings.join('; ')}`;
        }
      }
    } catch {
      directive = response.slice(0, 500);
    }

    return {
      role: AgentRole.WORLD,
      status: AgentStatus.DONE,
      content,
      directive: directive ? `[WORLD AGENT DIRECTIVE]\n${directive}` : '',
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error: any) {
    return {
      role: AgentRole.WORLD,
      status: AgentStatus.ERROR,
      content: `세계관 에이전트 오류: ${error.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}
