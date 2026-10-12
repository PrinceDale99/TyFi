'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import PostHogPageView from './posthog-pageview';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_pwnTyiWCpgf4VnWxpJHVYWyXUebg3DHqeyko3k68Dy5d';
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!key) {
      console.warn('PostHog key is missing in environment configuration.');
      return;
    }

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false, // Managed manually by PostHogPageView component
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage+cookie',
    });
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PostHogProvider>
  );
}
