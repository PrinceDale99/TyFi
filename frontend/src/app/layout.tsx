import type { Metadata } from 'next';
import { AnalyticsProvider } from './providers';
import '../index.css';

export const metadata: Metadata = {
  title: 'TyFi — Parametric Typhoon Resilience Vault',
  description: 'Parametric agricultural insurance and climate liquidity vault on Stellar Soroban.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <AnalyticsProvider>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
