import { callAgentAI } from '../../services/agentService';
import { AgentRole, AgentStatus, AgentOutput, AgentContext } from './types';

// ============================================================
// QA Agent (검수 에이전트)
// ============================================================
// Responsibilities:
// 1. POST-GEN: Review generated content for quality issues
// 2. Check for AI tone, repetition, show-don't-tell violations
// 3. Verify narrative continuity and logic
// 4. Flag issues but does NOT modify the text
// ============================================================

const QA_SYSTEM_PROMPT = `당신은 소설 원고의 품질 검수관(QA Inspector)입니다. 당신의 역할:

생성된 원고를 읽고 다음 항목을 검수합니다:

1. **AI톤 검출**: "그러나", "한편으로는", "따라서" 등 AI 특유의 접속사 남용
2. **반복 표현**: 동일 묘사, 동일 구문 3회 이상 반복
3. **Show Don't Tell 위반**: "슬픔을 느꼈다", "분노했다" 등 감정 직접 서술
4. **시점 위반**: POV 캐릭터가 아닌 인물의 내면 묘사
5. **논리적 모순**: 장면 내 인과관계 오류
6. **미완성 장면**: 갑작스러운 장면 전환, 미완결 대화
7. **문장 리듬**: 지나치게 균일한 문장 길이
8. **클리셰**: 과도한 클리셰 사용

응답 형식 (JSON):
{
  "passRate": 0-100,
  "issues": [
    {
      "type": "ai_tone|repetition|show_tell|pov_violation|logic_error|incomplete|rhythm|cliche",
      "severity": "critical|major|minor",
      "location": "문제가 있는 문장 일부 인용",
      "description": "무엇이 문제인지",
      "suggestion": "개선 방안"
    }
  ],
  "strengths": ["잘된 점들"],
  "overallComment": "종합 코멘트"
}`;

export async function runQAAgent(ctx: AgentContext): Promise<AgentOutput> {
  const start = performance.now();

  try {
    if (!ctx.generatedContent) {
      return {
        role: AgentRole.QA,
        status: AgentStatus.SKIPPED,
        content: '생성된 콘텐츠 없음.',
        durationMs: Math.round(performance.now() - start),
      };
    }

    const userPrompt = `에피소드: ${ctx.config.episode}
장르: ${ctx.config.genre}
시점 캐릭터: ${ctx.config.povCharacter}
시점 유형: ${ctx.config.povType || '미설정'}

[생성된 원고]
${ctx.generatedContent.slice(0, 4000)}

위 원고를 검수하고 품질 이슈를 보고하세요.`;

    const response = await callAgentAI({
      systemPrompt: QA_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1536,
      temperature: 0.2,
      signal: ctx.config._agentSignal as AbortSignal | undefined,
    });

    let content = response;
    let metadata: Record<string, any> = {};

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        metadata = {
          passRate: parsed.passRate,
          issueCount: parsed.issues?.length || 0,
          issues: parsed.issues || [],
          strengths: parsed.strengths || [],
        };

        const criticalCount = (parsed.issues || []).filter((i: any) => i.severity === 'critical').length;
        const majorCount = (parsed.issues || []).filter((i: any) => i.severity === 'major').length;
        const minorCount = (parsed.issues || []).filter((i: any) => i.severity === 'minor').length;

        content = `검수 완료 — 통과율: ${parsed.passRate}%. `;
        if (criticalCount > 0) content += `치명적: ${criticalCount}건, `;
        if (majorCount > 0) content += `주요: ${majorCount}건, `;
        if (minorCount > 0) content += `경미: ${minorCount}건. `;
        if (parsed.overallComment) content += parsed.overallComment;
      }
    } catch {
      // keep raw response as content
    }

    return {
      role: AgentRole.QA,
      status: AgentStatus.DONE,
      content,
      metadata,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error: any) {
    return {
      role: AgentRole.QA,
      status: AgentStatus.ERROR,
      content: `검수 에이전트 오류: ${error.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}
