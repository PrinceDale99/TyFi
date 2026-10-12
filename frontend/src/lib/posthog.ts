import posthog from 'posthog-js'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_POSTHOG_HOST
const isPostHogEnabled = Boolean(posthogKey && posthogHost)

if (!isPostHogEnabled) {
  if (import.meta.env.DEV) {
    const missingVariable = !posthogKey ? 'VITE_POSTHOG_KEY' : 'VITE_POSTHOG_HOST'
    throw new Error(
      `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
    )
  }
} else {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    logs: {
      serviceName: 'typhoon-resilience-vault-web',
      environment: import.meta.env.MODE,
    },
  })
}

export function capturePostHogEvent(event: string, properties?: Record<string, unknown>): void {
  if (!isPostHogEnabled) return
  posthog.capture(event, properties)
}

export function logPostHogInfo(body: string, attributes?: Record<string, string | number | boolean>): void {
  if (!isPostHogEnabled) return
  posthog.logger.info(body, attributes)
}

export { posthog, isPostHogEnabled }
