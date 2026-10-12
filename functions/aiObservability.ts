import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { PostHog } from 'posthog-node';

dotenv.config();

type GeminiGeneration = {
  traceId?: string;
  sessionId?: string | null;
  distinctId?: string;
  model: string;
  input: unknown;
  output?: string;
  latencyMs: number;
  status?: number;
  error?: unknown;
};

const posthogKey = process.env.POSTHOG_API_KEY;
const posthogHost = process.env.POSTHOG_HOST;

if ((!posthogKey || !posthogHost) && process.env.NODE_ENV !== 'production') {
  const missingVariable = !posthogKey ? 'POSTHOG_API_KEY' : 'POSTHOG_HOST';
  throw new Error(`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`);
}

const posthog = posthogKey && posthogHost
  ? new PostHog(posthogKey, {
      host: posthogHost,
      privacyMode: true,
    })
  : undefined;

const defaultAiSessionId = `server-process-${randomUUID()}`;

export const createAiTraceId = () => randomUUID();

export async function captureGeminiGeneration({
  traceId = createAiTraceId(),
  sessionId = defaultAiSessionId,
  distinctId,
  model,
  input,
  output,
  latencyMs,
  status,
  error,
}: GeminiGeneration): Promise<void> {
  if (!posthog) return;

  try {
    const redactedInput = Array.isArray(input)
      ? [{ role: 'user', content: '[redacted]' }]
      : '[redacted]';
    const errorType = error instanceof Error ? error.name : typeof error;

    posthog.capture({
      distinctId: distinctId || `anonymous-${traceId}`,
      event: '$ai_generation',
      properties: {
        $ai_trace_id: traceId,
        $ai_session_id: sessionId,
        $ai_model: model,
        $ai_provider: 'gemini',
        $ai_input: redactedInput,
        ...(output !== undefined ? {
          $ai_output_choices: [{ role: 'assistant', content: '[redacted]' }],
        } : {}),
        $ai_latency: latencyMs / 1000,
        ...(!distinctId ? { $process_person_profile: false } : {}),
        ...(status !== undefined ? { $ai_http_status: status } : {}),
        ...(error ? { $ai_is_error: true, $ai_error: errorType } : {}),
      },
    });
    await posthog.flush();
  } catch {
    return;
  }
}
