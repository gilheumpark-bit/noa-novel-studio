import { AgentRole, AgentStatus, AgentOutput, AgentContext } from './types';
import { buildSystemInstruction, buildUserPrompt } from '../pipeline';
import { PlatformType } from '../types';

// ============================================================
// Writing Agent (집필 에이전트)
// ============================================================
// Responsibilities:
// 1. Generate story content using the full engine pipeline
// 2. Incorporate directives from pre-generation agents
// 3. The ONLY agent that produces the actual narrative text
// ============================================================

/**
 * Build an enhanced system instruction that incorporates agent directives.
 * The writing agent uses the existing pipeline but injects additional context
 * from the memory, world, and character agents.
 */
export function buildAgentEnhancedPrompt(
  ctx: AgentContext,
  agentDirectives: string[],
): { systemInstruction: string; userPrompt: string } {
  const platform = ctx.config.platform ?? PlatformType.MOBILE;
  const baseSystem = buildSystemInstruction(ctx.config, ctx.language, platform);
  const baseUser = buildUserPrompt(ctx.config, ctx.draft, {
    previousContent: undefined,
    language: ctx.language,
  });

  // Inject agent directives before the [OUTPUT RULES] section
  const directiveBlock = agentDirectives
    .filter(d => d.length > 0)
    .join('\n\n');

  const enhancedSystem = directiveBlock
    ? baseSystem.replace(
        '[SERIALIZATION CONSTRAINTS]',
        `${directiveBlock}\n\n[SERIALIZATION CONSTRAINTS]`
      )
    : baseSystem;

  return {
    systemInstruction: enhancedSystem,
    userPrompt: baseUser,
  };
}

/**
 * The writing agent itself doesn't call the AI — it provides the enhanced prompts
 * to the main generateStoryStream function. This keeps streaming working as-is.
 * The orchestrator uses buildAgentEnhancedPrompt and passes it to the existing
 * streaming infrastructure.
 */
export function createWritingAgentOutput(durationMs: number, success: boolean, error?: string): AgentOutput {
  return {
    role: AgentRole.WRITER,
    status: success ? AgentStatus.DONE : AgentStatus.ERROR,
    content: success ? '집필 완료.' : `집필 오류: ${error}`,
    durationMs,
  };
}
