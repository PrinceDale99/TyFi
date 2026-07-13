



# Frontend Architecture & Component Directory

This document provides a breakdown of the React components inside `src/components` and how they fit into the application's overall structure. The application is orchestrated by `App.tsx`, which handles global state and routing between these distinct features.

## Main Dashboards & Pages
*   **`App.tsx`**: The main orchestrator. Handles global state (wallet, network, weather, farms), layout (sidebar, main content area, right column), and conditionally renders tabs.
*   **`FarmerDashboard.tsx`**: The primary UI for Farmer users. Includes farm registration, overview, and quick actions.
*   **`LPDashboard.tsx`**: The primary UI for Liquidity Providers (Sponsors). Focuses on yield, TVL, and capital allocation.
*   **`LandingPage.tsx`**: The animated public-facing page users see before connecting a wallet. Features 3D models and protocol metrics.

## Sub-Pages (Tabs)
*   **`SmartCalculator.tsx`** (calc): AI-driven damage calculation and estimated recovery payout simulator.
*   **`HistoryDashboard.tsx`** (history): Displays a historical record of all triggered payouts and claims stored on Firebase.
*   **`LedgerStream.tsx`** (history): A real-time terminal-like view streaming events directly from the Soroban smart contract ledger.
*   **`PaymentSetup.tsx`** (payment): Interface for configuring fiat off-ramps (e.g., PDAX, Maya, GCash).
*   **`SubsidyMarketplace.tsx`** (marketplace): Allows sponsors to discover and fund specific farmer policies.
*   **`DocsTab.tsx`** (docs): In-app documentation and system overview.
*   **`GovernancePortal.tsx`** (governance): DAO voting interface for protocol upgrades and parameters.

## Core Features & Widgets
*   **`WeatherMap.tsx`**: Interactive Leaflet map displaying registered farm coordinates and current storm intensity.
*   **`WeatherChart.tsx`**: Recharts-based visualizations of historical and predicted weather trends.
*   **`WeatherWidget.tsx`**: Compact UI showing current wind speed, rainfall, and temperature from the Open-Meteo Oracle.
*   **`MarketWidget.tsx`**: Displays real-time agricultural commodity prices.
*   **`AssetDistribution.tsx`**: Analyzes the crop types across the user's farms and displays a breakdown.
*   **`PayoutStatus.tsx`**: Dynamic alert box that appears when a storm trigger is met, allowing the farmer to claim their payout.
*   **`AiCopilot.tsx`**: A Gemini-powered chat interface embedded in the sidebar/right-column for instant context-aware assistance.
*   **`AdvancedFeatures.tsx`**: The Debug Dashboard and API playground for testing all dApp features (currently being upgraded).
*   **`WalletModal.tsx`**: UI for handling Freighter/Albedo wallet connection.
*   **`FarmerVerification.tsx` / `PaymentSetup.tsx`**: Onboarding flows for new users.

## How to Refactor `App.tsx`
To further shrink `App.tsx`, we should progressively extract:
1.  **`VaultTab.tsx`**: The inline TVL and Liquidity Vault UI.
2.  **`SandboxSimulator.tsx`**: The inline Developer Testnet Weather simulation controls.
3.  **`SidebarNavigation.tsx`**: The floating glassmorphic sidebar layout.
