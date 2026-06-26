# PDAX Institutional API APAC Stellar Hackathon Integration Playbook

## 1. Introduction
Welcome to the PDAX Institutional API Integration Playbook for the APAC Stellar Hackathon.
This guide is intended to help hackathon participants explore and integrate with PDAX API services for fiat and crypto-enabled financial workflows.

The PDAX Institutional API enables integrations for:
* Fiat / Crypto conversion
* Crypto deposits
* Fiat deposits
* Fiat withdrawals
* Wallet and balance management
* Trading workflows
* Real-time event notifications via webhooks

Detailed endpoint specifications, schemas, and API references are available in the official PDAX API Documentation.

## 2. API Documentation Access
Participants may access the API documentation through the following portal:
* **PDAX API documentation**: https://doc.general.api.pdax.ph/#introduction

The documentation portal includes:
* Authentication flows
* Trading APIs
* Funding APIs
* Withdrawal APIs
* Webhook documentation
* Error codes
* Accepted values
* Bank code references

Documentation access credentials will be provided to registered participants.
Test account credentials will be distributed separately via email after participants accomplish the PDAX NDA & Technical Access Form.

## 3. Environment Information
PDAX provides a UAT environment for testing and integration validation.

| Environment | Purpose | Base URL |
| :--- | :--- | :--- |
| UAT | Testing and integration validation | `https://uat.services.sandbox.pdax.ph/api/pdax-api` |

The UAT environment is intended for:
* integration testing
* proof-of-concept development
* sandbox experimentation
* hackathon-related development activities

**UAT Environment Availability**
To support participants throughout the APAC Stellar Hackathon, the UAT environment will be available 24 hours a day, 7 days a week for the duration of the event. This includes weekends and holidays and will remain in effect until the official completion of the APAC Stellar Hackathon. While PDAX aims to maintain continuous availability during this period, occasional maintenance activities or service interruptions may occur when necessary.

**UAT Environment Disclaimer**
The UAT environment uses:
* mock pricing
* mock liquidity
* simulated transaction behavior

Participants should not treat UAT activity as real financial transactions or production-grade settlement behavior. PDAX does not guarantee uninterrupted availability, production-equivalent performance, real market execution, or real liquidity conditions within the UAT environment. Environment data, balances, quotes, and transactions may be reset, modified, delayed, or removed without prior notice.

## 4. Legal Disclaimer
The UAT environment is provided solely for testing, development, evaluation, and hackathon participation purposes.
Users must not rely on UAT results for operational, accounting, commercial, or financial purposes.
PDAX reserves the right to restrict access, suspend credentials, apply usage limitations, or modify environment behavior when necessary.

## 5. Authentication
Once credentials are issued, participants may authenticate using the login endpoint.

**Login Endpoint**
* `POST /pdax-institution/v1/login`

Authentication returns:
* `access_token`
* `id_token`
* `refresh_token`

**MFA Support**
The API supports optional MFA-enabled authentication flows using OTP verification.

**Refresh Tokens**
Participants may refresh authentication sessions using:
* `PUT /pdax-institution/v1/refresh-token`

**Required Headers**
Authenticated requests require:
* `access_token`
* `id_token`

## 6. Core API Workflows
The PDAX API currently supports the following workflows:

| Capability | Description |
| :--- | :--- |
| Trading | Fiat / Crypto conversion |
| Funding | Fiat and crypto funding |
| Wallets | Crypto deposit address generation |
| Withdrawals | Fiat withdrawals |
| Balances | Wallet balance retrieval |
| Webhooks | Real-time event notifications |

## 7. Trading APIs
The Trading APIs support indicative pricing, executable firm quotes, and trade execution workflows.

* **Indicative Quote**: `GET /pdax-institution/v1/trade/price` (retrieve estimated market pricing for supported trading pairs).
* **Firm Quote**: `POST /pdax-institution/v1/trade/quote` (obtain an executable quote prior to trade execution).
* **Execute Trade**: `POST /pdax-institution/v1/trade` (place a trade using a valid firm quote).
* **Order Status**: `GET /pdax-institution/v1/orders/{order_id}` (verify order status).

## 8. Funding APIs
**Crypto Deposits**
* `GET /pdax-institution/v1/crypto/deposit`
Returns: wallet address, destination tag/memo (if applicable)

**Fiat Deposits**
* `POST /pdax-institution/v1/fiat/deposit`
Used to initiate fiat funding workflows. Responses may return payment checkout URL, transaction reference, pending transaction status.

## 9. Withdrawal APIs
**Fiat Withdrawals**
* `POST /pdax-institution/v1/fiat/withdraw`
Used to withdraw fiat funds to supported payout channels.

## 10. Webhook Integration
PDAX supports webhook-based event notifications for deposits, withdrawals, trades, and transaction updates.

## 11. Error Handling
The API returns standard HTTP status codes, structured error responses, and domain-specific error codes.
Documented error examples include: Unauthorized access, Invalid parameters, Asset unavailable, Insufficient balance, Invalid quantity step, Limit validation errors.

## 12. APAC Stellar Hackathon Support
**Technical Support Availability**
* Monday to Friday
* 1:00 PM – 6:00 PM Philippine Time
* Excluding weekends and holidays

Participants experiencing credential issues, environment access concerns, or technical integration problems may coordinate through the designated event support channels (e.g. Telegram support group).

## 13. Frequently Asked Questions
*(Refer to main documentation for FAQ details on onboarding, environment, authentication, trading, funding, and support).*

---

## Appendix A - Supported Assets
The following digital assets are currently supported for use within the APAC Stellar Hackathon UAT environment.

| Asset Symbol | Asset Name | Remarks |
| :--- | :--- | :--- |
| XLM | Stellar Lumens | Supported |
| USDCXLM | USD Coin (Stellar Network) | Supported |

## Appendix B - Supported Networks (Blockchain Networks)
The following blockchain network(s) are supported within the APAC Stellar Hackathon UAT environment.

| Network | Description |
| :--- | :--- |
| XLM_USDC_T_CEKS | Stellar Testnet |

## Appendix C - Supported Payment Channels
| Payment Channel | Status |
| :--- | :--- |
| InstaPay | Supported |

## Appendix D - Supported Bank List
The following banks are available for testing deposit and withdrawal use cases within the APAC Stellar Hackathon UAT environment.

| Bank Name | Bank Code | Test Account Number | Status |
| :--- | :--- | :--- | :--- |
| Security Bank Corporation | BASECPH | 0000042001461 | Supported |
| CTBC Bank Philippines Corporation | BACTBPH | 001700062270 | Supported |

## Appendix E - Supported Payout Channels
| Payout Channel | Status |
| :--- | :--- |
| InstaPay | Supported |

> **Additional References**: For the latest list of accepted values, request parameters, enumerations, bank codes, and error code references, participants should refer directly to the PDAX API documentation. The API documentation remains the source of truth for technical specifications.
