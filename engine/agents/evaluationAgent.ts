import { callAgentAI } from '../../services/agentService';
import { AgentRole, AgentStatus, AgentOutput, AgentContext, extractFirstJSON } from './types';

// ============================================================
// Evaluation Agent (평가 에이전트)
// ============================================================
// Responsibilities:
// 1. POST-GEN: Score and critique the generated content
// 2. Provide detailed literary analysis
// 3. Compare against genre expectations
// 4. Provide actionable feedback for improvement
// ============================================================

const EVAL_SYSTEM_PROMPT = `당신은 소설 평론가(Literary Critic Agent)입니다. 당신의 역할:

생성된 원고를 문학적 관점에서 심층 평가합니다.

평가 항목:
1. **서사 밀도**: 장면당 정보/감정 전달의 효율성
2. **캐릭터 깊이**: 인물의 입체성과 일관성
3. **대화 품질**: 자연스러움, 서브텍스트, 캐릭터별 차별화
4. **장르 적합성**: 장르 컨벤션 충족도
5. **감정 전달**: 독자에게 감정이 효과적으로 전달되는가
6. **긴장감 관리**: 서스펜스, 페이싱, 클리프행어
7. **문체**: 문장의 아름다움, 리듬, 독창성
8. **몰입도**: 독자가 이탈하는 지점이 있는가

응답 형식 (JSON):
{
  "overallScore": 0-100,
  "letterGrade": "S++|S+|S|A+|A|B+|B|C+|C|D|F",
  "scores": {
    "narrativeDensity": 0-100,
    "characterDepth": 0-100,
    "dialogueQuality": 0-100,
    "genreFit": 0-100,
    "emotionalImpact": 0-100,
    "tensionManagement": 0-100,
    "prose": 0-100,
    "immersion": 0-100
  },
  "critique": "상세한 비평 (3-5문장)",
  "highlights": ["특히 잘된 부분"],
  "improvements": ["개선이 필요한 구체적 사항"],
  "readerExperience": "독자가 이 에피소드를 읽으면 느낄 감정/반응 예측"
}`;

export async function runEvaluationAgent(ctx: AgentContext): Promise<AgentOutput> {
  const start = performance.now();

  try {
    if (!ctx.generatedContent) {
      return {
        role: AgentRole.EVALUATOR,
        status: AgentStatus.SKIPPED,
        content: '평가할 콘텐츠 없음.',
        durationMs: Math.round(performance.now() - start),
      };
    }

    const engineMetrics = ctx.report
      ? `엔진 EOS: ${ctx.report.eosScore}, 긴장도: ${ctx.report.metrics.tension}, 페이싱: ${ctx.report.metrics.pacing}, 몰입도: ${ctx.report.metrics.immersion}`
      : '엔진 메트릭 없음';

    const userPrompt = `에피소드: ${ctx.config.episode} / ${ctx.config.totalEpisodes}
장르: ${ctx.config.genre}
시점 캐릭터: ${ctx.config.povCharacter}
목표 긴장도: ${ctx.report?.tensionTarget || '미설정'}%
${engineMetrics}

[생성된 원고]
${ctx.generatedContent.slice(0, 4000)}

위 원고를 문학적 관점에서 심층 평가하세요. 장르(${ctx.config.genre})의 기대치와 비교하세요.`;

    const response = await callAgentAI({
      systemPrompt: EVAL_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1536,
      temperature: 0.4,
      signal: ctx.config._agentSignal as AbortSignal | undefined,
    });

    let content = response;
    let metadata: Record<string, any> = {};

    try {
      const jsonMatch = extractFirstJSON(response);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch);
        metadata = {
          overallScore: parsed.overallScore,
          letterGrade: parsed.letterGrade,
          scores: parsed.scores,
          highlights: parsed.highlights,
          improvements: parsed.improvements,
          readerExperience: parsed.readerExperience,
        };

        content = `평가 완료 — ${parsed.letterGrade} (${parsed.overallScore}점). ${parsed.critique || ''}`;
      }
    } catch {
      // keep raw response
    }

    return {
      role: AgentRole.EVALUATOR,
      status: AgentStatus.DONE,
      content,
      metadata,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error: any) {
    return {
      role: AgentRole.EVALUATOR,
      status: AgentStatus.ERROR,
      content: `평가 에이전트 오류: ${error.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}
