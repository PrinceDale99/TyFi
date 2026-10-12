import dotenv from 'dotenv';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';

dotenv.config();

const posthogProjectToken = process.env.POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.POSTHOG_HOST;

if ((!posthogProjectToken || !posthogHost) && process.env.NODE_ENV !== 'production') {
  const missingVariable = !posthogProjectToken ? 'POSTHOG_PROJECT_TOKEN' : 'POSTHOG_HOST';
  throw new Error(`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`);
}

if (posthogProjectToken && posthogHost) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'typhoon-resilience-vault-api',
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${posthogHost.replace(/\/$/, '')}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${posthogProjectToken}`,
          },
        }),
      }),
    ],
  });

  sdk.start();
}

const posthogLogger = logs.getLogger('typhoon-resilience-vault-posthog');

type PostHogLogSeverity = 'info' | 'warn' | 'error';

export function logPostHog(
  severityText: PostHogLogSeverity,
  body: string,
  attributes: Record<string, string | number | boolean> = {},
): void {
  if (!posthogProjectToken || !posthogHost) return;

  posthogLogger.emit({
    severityText,
    body,
    attributes,
  });
}
