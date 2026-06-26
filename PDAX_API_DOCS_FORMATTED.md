# PDAX API for Institutions Documentation

## Introduction
Welcome to PDAX API for Institutions Documentation.

The PDAX API is organized around the following workflows:
- Conversion of fiat to crypto and crypto to fiat.
- Withdrawals for Fiat or Crypto.
- Deposits for Fiat and Crypto.
- Viewing of balances and withdrawals.

Our API has predictable resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs.

## Getting Started
Use the following environments for your intended purpose. For Stage environment credentials, kindly contact your relationship manager to request for access.

| Environment | Base URL |
| :--- | :--- |
| **Production** | `https://services.pdax.ph/api/pdax-api` |
| **Stage** | `https://stage.services.sandbox.pdax.ph/api/pdax-api` |
| **UAT** | `https://uat.services.sandbox.pdax.ph/api/pdax-api` |

**Disclaimer:** The staging environment is intended for development and integration testing only. Availability of payment channels, redirect flows, third-party services, and transaction completion behavior may vary and can change without prior notice. Certain payment methods or services may become temporarily unavailable depending on staging provider availability and environment configuration.

### Environment Access Requirements
Before staging access or testing can be granted, clients must provide their static public IP address(es) to the PDAX team for whitelisting. Access attempts from non-whitelisted IPs will be blocked.

If your IP has not been whitelisted, API requests will return the following error:

****Sample Response (403):****
`json
```json
{
  "message": "Blocked due to unauthorized access. IP list not found."
}
```
`

To request staging or test account access, or to submit IP addresses for whitelisting, please contact your relationship manager or reach out to the PDAX team directly.

## Authentication

### POST Login
If MFA is not enabled for your PDAX account, use this endpoint to obtain access token and id token for authentication of API calls. Access and id tokens are valid for 10 minutes. POST /login will also return a refresh token that can be used to obtain new access and id tokens by calling Refresh Token endpoint.

If MFA is enabled for your PDAX account, use this endpoint to obtain a session token then call POST OTP endpoint to obtain access, id, and refresh tokens.

**HTTP request**
`POST /pdax-institution/v1/login`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v1/login' \
--header 'Content-Type: application/json' \
--data-raw '{
"username": "example@gmail.com",
"password": "P@ssw0rd"
}'
```

****Without MFA Setup Sample Response (200):****
`json
```json
{
    "email": "example@gmail.com",
    "username": "96a8c8b5-8fee-40c9-9242-a5cd172e9a96",
    "groups": [
        "exchange_user"
    ],
    "token_type": "Bearer",
    "preferred_mfa": "SOFTWARE_TOKEN_MFA",
    "expiry": 600,
    "access_token": "eyJraWQiOiJ4UjJ2U1A2",
    "id_token": "eyJraWQiOiJsQzlPbldQV2ZX",
    "refresh_token": "eyJjdHkiOiJKV1QiLCJ"
}
```
`

****With MFA Setup Sample Response (200):****
`json
```json
{
    "code": "AuthChallengeRequired",
    "message": "An authentication challenge is configured for this account.",
    "challenge_name": "SOFTWARE_TOKEN_MFA",
    "session": "{{SESSION_TOKEN}}"
}
```
`

#### Schema of Body Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| username | string | yes | Email address of PDAX account |
| password | string | yes | Password of PDAX account |

#### Schema of Response Payload (Without MFA Setup)
| Key | Type | Description |
| :--- | :--- | :--- |
| email | string | Email address of PDAX account |
| username | string | ID number of PDAX account |
| groups | array | List of groups user belongs to |
| token_type | string | Type of authentication token (e.g., "Bearer") |
| preferred_mfa | string | MFA preference status (e.g., "NOT_SET", "SOFTWARE_TOKEN_MFA") |
| expiry | number | Access and id token validity period in seconds |
| access_token | string | JWT token for API authorization. Access token is valid for 10 minutes. |
| id_token | string | JWT token for user identity. ID token is valid for 10 minutes. |
| refresh_token | string | Token to refresh authentication without reauthentication. Refresh token is valid for 30 days. |

#### Schema of Response Payload (With MFA Setup)
| Key | Type | Description |
| :--- | :--- | :--- |
| code | string | Response code from authentication service |
| message | string | Descriptive message about the MFA challenge |
| challenge_name | string | Type of challenge required (e.g., "SOFTWARE_TOKEN_MFA") |
| session | string | Session token for completing the MFA challenge |

#### Error Response
**Sample Error Response**
```json
{"code": "InvalidCredentials", "message": "Incorrect username or password."}
```

| Code | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| InvalidCredentials | Incorrect username or password. | 401 | The provided username or password is incorrect |
| AccountLocked | Account is locked. | 401 | The account has been locked due to multiple failed login attempts |
| ExpiredTemporaryPassword | Temporary password has expired. | 401 | The temporary password is no longer valid |

### POST OTP
If MFA is enabled for your PDAX account, use this endpoint to obtain access, id, and refresh tokens.

**HTTP request**
`POST /pdax-institution/v1/login/otp`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v1/login/otp' \
--header 'Content-Type: application/json' \
--data-raw '{
"session":"{{SESSION_TOKEN}}",
"username": "example@gmail.com",
"otp": "676788"
}'
```

****Sample Response (200):****
`json
```json
{
    "email": "example@gmail.com",
    "username": "96a8c8b5-8fee-40c9-9242-a5cd172e9a96",
    "groups": [
        "exchange_user"
    ],
    "token_type": "Bearer",
    "preferred_mfa": "SOFTWARE_TOKEN_MFA",
    "expiry": 600,
    "access_token": "eyJraWQiOiJ4UjJ2U1A2",
    "id_token": "eyJraWQiOiJsQzlPbldQV2ZX",
    "refresh_token": "eyJjdHkiOiJKV1QiLCJ"
}
```
`

#### Schema of Body Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| session | string | yes | MFA session token |
| username | string | yes | Email address of PDAX account |
| otp | string | yes | One-time password code |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| email | string | Email address of PDAX account |
| username | string | ID number of PDAX account |
| groups | array | List of groups user belongs to |
| token_type | string | Type of authentication token (e.g., "Bearer") |
| preferred_mfa | string | MFA preference status (e.g., "SOFTWARE_TOKEN_MFA") |
| expiry | number | Access and id token validity period in seconds |
| access_token | string | JWT token for API authorization. Access token is valid for 10 minutes. |
| id_token | string | JWT token for user identity. ID token is valid for 10 minutes. |
| refresh_token | string | Token to refresh authentication without reauthentication. Refresh token is valid for 30 days. |

#### Error Response
**Sample Error Responses**
```json
{"code": "InvalidMfaCode", "message": "Invalid session for the user, session is expired."}
{"code": "InvalidMfaCode", "message": "Invalid code received for user."}
{"code": "InvalidMfaCode", "message": "Invalid session for the user, session can only be used once."}
{"code": "InvalidMfaCode", "message": "Your software token has already been used once."}
```

| Code | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| InvalidMfaCode | Invalid session for the user, session is expired. | 500 | Invalid session token. |
| InvalidMfaCode | Invalid code received for user. | 500 | Invalid otp. |
| InvalidMfaCode | Invalid session for the user, session can only be used once. | 500 | Session token already used. |
| InvalidMfaCode | Your software token has already been used once. | 500 | OTP already used. |

### PUT Refresh Token
Use this endpoint to obtain a new access token and id token when the old access and id tokens expire after 10 minutes. Refresh token is valid for 30 days.

**HTTP request**
`PUT /pdax-institution/v1/refresh-token`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v1/refresh-token' \
--header 'Content-Type: application/json' \
--data-raw '{
"username": "example@gmail.com",
"refreshToken": "eyJraWQiOiJwTXRndmx1UGQ1ZG5YK2U1MXNLQUFSSUpiTW00TnA5SzFUdlZDK0xLVmY4PSIsImFsZyI6IlJTMjU2In0"
}'
```

****Sample Response (200):****
`json
```json
{
    "email": "example@gmail.com",
    "username": "48e0fe9e-0724-4b80-9eb7-c61b53cd7346",
    "groups": [
        "insti_user"
    ],
    "token_type": "Bearer",
    "preferred_mfa": "NOT_SET",
    "expiry": 600,
    "access_token": "eyJraWQiOiJwTXRndmx1UGQ1ZG5YK2U1MXNLQUFSSUpiTW00TnA5SzFUdlZDK0xLVmY4PSIsImFsZyI6IlJTMjU2In0.",
    "id_token": "eyJraWQiOiJ6dU5uUkVqVmNpUTZ5ektqZEhUOVZoZGZtUzdSSkpzQjQ4ZUZ3S04wdUxZPSIsImFsZyI6IlJTMjU2In0",
    "refresh_token": "eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ."
}
```
`

#### Schema of Body Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| username | string | yes | Email address of PDAX account |
| refreshToken | string | yes | Token for refresh session |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| email | string | Email address of PDAX account |
| username | string | ID number of PDAX account |
| groups | array | List of groups user belongs to |
| token_type | string | Type of authentication token (e.g., "Bearer") |
| preferred_mfa | string | MFA preference status (e.g., "NOT_SET") |
| expiry | number | Access and id token validity period in seconds |
| access_token | string | JWT token for API authorization |
| id_token | string | JWT token for user identity |
| refresh_token | string | Token to refresh authentication without reauthentication |

#### Error Response
**Sample Error Responses**
```json
{"code": "BadRequestException", "message": "{'refresh_token': ['Missing data for required field.']}"}
{"code": "InvalidMfaCode", "message": "Invalid session for the user, session can only be used once."}
{"code": "InvalidMfaCode", "message": "Invalid code or auth state for the user."}
{"code": "NotAuthorizedException", "message": "Invalid Refresh Token"}
{"code": "NotAuthorizedException", "message": "SecretHash does not match for the client: 6ojv9ilmtgimddqfkvhj4m9vim"}
```

| Code | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| BadRequestException | 'refresh_token': ['Missing data for required field.'] | 400 | Missing refreshToken field |
| InvalidMfaCode | Invalid session for the user, session can only be used once. | 401 | OTP previously used |
| InvalidMfaCode | Invalid code or auth state for the user. | 401 | Invalid OTP |
| NotAuthorizedException | Invalid Refresh Token | 401 | Invalid Refresh Token |
| NotAuthorizedException | SecretHash does not match for the client: {{PDAX account ID number}} | 401 | PDAX account and refresh_token do not match |

## Trade

### GET Indicative Price
Get an indicative quote for the desired trading pair. The quote returned by this endpoint is for indicative purposes only and cannot be accepted by the user.

**HTTP request**
`GET /pdax-institution/v1/trade/price`

**Sample Request:**
```bash
curl --location --request GET 'https://API_DOMAIN/pdax-institution/v1/trade/price?quote_currency=USDC&base_currency=PHP&side=sell&base_quantity=100'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'
```

****Sample Response (200):****
`json
```json
{
    "data": {
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "sell",
        "base_quantity": "100",
        "price": 55,
        "total_amount": 5500
    },
    "status": "success"
}
```
`

#### Schema of Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| quote_currency | string | yes | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | yes | PHP asset |
| side | string | yes | Counterparty action -- buy or sell |
| base_quantity | string | yes | Quantity to buy or sell. Note: Quantity step rules apply. |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| quote_currency | string | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | PHP asset |
| side | string | Counterparty action -- buy or sell |
| base_quantity | string | Quantity of the asset you are buying or selling |
| price | decimal | Quoted unit price |
| total_amount | decimal | Total amount |

#### Error Response
**Sample Error Responses**
```json
{ "code": 400, "name": "OTCServiceError", "message": "side must be buy or sell" }
{ "code": 400, "name": "OTCServiceError", "message": "quote_currency is required" }
{ "code": 400, "name": "OTCServiceError", "message": "base_currency is required" }
{ "code": 400, "name": "OTCServiceError", "message": "'base_quantity' must be larger than or equal to 0" }
```

| Code | Name | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| 400 | OTCServiceError | side must be buy or sell | 400 | The "side" field must be either "buy" or "sell". |
| 400 | OTCServiceError | "quote_currency" is required | 400 | The "quote_currency" field is required. |
| 400 | OTCServiceError | "base_currency" is required | 400 | The "base_currency" field is required. |
| 400 | OTCServiceError | 'base_quantity' must be larger than or equal to 0 | 400 | The "base_quantity" must be a number ≥ 0. |

### POST Firm Quote
Get a firm quote for the desired trading pair. The quote returned by this endpoint can be accepted by calling POST Order if the user wants to place an order and execute a trade.

**HTTP request**
`POST /pdax-institution/v1/trade/quote`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v1/trade/quote'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--data-raw '{
"quote_currency": "USDC",
"base_currency": "PHP",
"side": "sell",
"base_quantity": "100"
}'
```

****Sample Response (200):****
`json
```json
{
    "data": {
        "quote_id": "0188b945-cbfa-7b8b-9fea-bfcc2ac25c8c",
        "expires_at": "2023-06-14T09:41:15.423874Z",
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "sell",
        "base_quantity": 100,
        "price": 55,
        "total_amount": 5500
    },
    "status": "success"
}
```
`

#### Schema of Body Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| quote_currency | string | yes | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | yes | PHP asset |
| side | string | yes | Counterparty action -- buy or sell |
| base_quantity | string | yes | Quantity to buy or sell. Note: Quantity step rules apply. |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| quote_id | string | Firm quote reference ID |
| expires_at | string | Quote validity in ISO timestamp. Firm quotes are only valid for 15 seconds. |
| quote_currency | string | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | PHP asset |
| side | string | Counterparty action -- buy or sell |
| base_quantity | decimal | Quantity of the asset you are buying or selling |
| price | decimal | Quoted unit price |
| total_amount | decimal | Total amount |

#### Error Response
**Sample Error Responses**
```json
{ "code": 400, "name": "OTCServiceError", "message": "side must be buy or sell" }
{ "code": 400, "name": "OTCServiceError", "message": "'quote_currency' is not allowed to be empty" }
{ "code": 400, "name": "OTCServiceError", "message": "'base_currency' is not allowed to be empty" }
{ "code": 400, "name": "OTCServiceError", "message": "'base_quantity' must be a number" }
{ "code": 400, "name": "OTCServiceError", "message": "'base_quantity' must be larger than or equal to 0" }
{ "code": 400, "name": "OTCServiceError", "message": "Bad Request" }
{ "code": "OT010003", "name": "OTCServiceError", "message": "Trading Pair cannot be found or has been expired."}
{ "code": "OT010016", "name": "OTCServiceError", "message": "Asset unavailable" }
{ "code": "OT010029", "name": "OTCServiceError", "message": "Invalid Quantity Step" }
{ "code": "OT010030", "name": "OTCServiceError", "message": "Invalid Price Step" }
```

| Code | Name | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| 400 | OTCServiceError | side must be buy or sell | 400 | side must be buy or sell |
| 400 | OTCServiceError | "quote_currency" is not allowed to be empty | 400 | "quote_currency" is not allowed to be empty |
| 400 | OTCServiceError | "base_currency" is not allowed to be empty | 400 | "base_currency" is not allowed to be empty |
| 400 | OTCServiceError | "base_quantity" must be a number | 400 | "base_quantity" must be a number |
| 400 | OTCServiceError | "base_quantity" must be larger than or equal to 0 | 400 | "base_quantity" must be larger than or equal to 0 |
| 400 | OTCServiceError | Bad Request | 400 | Quote quantity must be between: here |
| OT010003 | OTCServiceError | Trading Pair cannot be found or has been expired | 400 | Invalid quote_currency or base_currency |
| OT010016 | OTCServiceError | Asset unavailable | 500 | Asset unavailable |
| OT010029 | OTCServiceError | Invalid Quantity Step | 400 | Invalid Quantity Step |
| OT010030 | OTCServiceError | Invalid Price Step | 400 | Invalid Price Step |

### GET Indicative Price v2
Get an indicative quote for the desired trading pair. The quote returned by this endpoint is for indicative purposes only and cannot be accepted by the user.

**HTTP request**
`GET /pdax-institution/v2/trade/price`

**Sample Request:**
```bash
curl --location --request GET 'https://API_DOMAIN/pdax-institution/v2/trade/price?side=buy&quote_currency=USDC&base_currency=PHP&currency=USDC&quantity=1000'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'
```

****Sample Response (200):****
`json
```json
{
    "data": {
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "buy",
        "base_quantity": 17.18,
        "price": 58.196,
        "total_amount": 1000
    },
    "status": "success"
}
```
`

#### Schema of Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| side | string | yes | Counterparty action -- buy or sell |
| quote_currency | string | yes | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | yes | PHP asset |
| currency | string | yes | The currency of which you want to receive |
| quantity | string | yes | Quantity to buy or sell. Note: Quantity step rules apply. |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| quote_currency | string | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | PHP asset |
| side | string | Counterparty action -- buy or sell |
| base_quantity | decimal | Quantity of the asset you are buying or selling |
| price | decimal | Quoted unit price |
| total_amount | decimal | Total amount |

#### Error Response
**Sample Error Responses**
```json
{ "code": 400, "name": "OTCServiceError", "message": "side must be buy or sell" }
{ "code": 400, "name": "OTCServiceError", "message": "quote_currency is required" }
{ "code": 400, "name": "OTCServiceError", "message": "base_currency is required" }
{ "code": 400, "name": "OTCServiceError", "message": "currency is required" }
{ "code": 400, "name": "OTCServiceError", "message": "quantity must be a number, quantity must be a valid number" }
{ "code": "OT010003", "name": "OTCServiceError", "message": "Trading Pair cannot be found or has been expired." }
{ "code": "OT010016", "name": "OTCServiceError", "message": "Asset unavailable" }
{ "code": "OT010026", "name": "OTCServiceError", "message": "Malformed parameters" }
{ "code": "OT010027", "name": "OTCServiceError", "message": "Order quantity is less than minimum required quantity" }
{ "code": "OT010028", "name": "OTCServiceError", "message": "Order quantity is greater than maximum required quantity" }
{ "code": "OT010029", "name": "OTCServiceError", "message": "Invalid Quantity Step" }
{ "code": "OT010030", "name": "OTCServiceError", "message": "Invalid Price Step" }
```

| Code | Name | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| 400 | OTCServiceError | side must be buy or sell | 400 | side must be buy or sell |
| 400 | OTCServiceError | "quote_currency" is required | 400 | "quote_currency" is required |
| 400 | OTCServiceError | "base_currency" is required | 400 | "base_currency" is required |
| 400 | OTCServiceError | "currency" is required | 400 | "currency" is required |
| 400 | OTCServiceError | "quantity" must be a number, quantity must be a valid number | 400 | "quantity" must be a number, quantity must be a valid number |
| OT010003 | OTCServiceError | Trading Pair cannot be found or has been expired. | 500 | Invalid quote_currency or base_currency. |
| OT010016 | OTCServiceError | Asset unavailable | 500 | Asset unavailable |
| OT010026 | OTCServiceError | Malformed parameters | 400 | Invalid currency parameter |
| OT010026 | OTCServiceError | Malformed parameters | 400 | Mismatch between quote_currency and currency parameters |
| OT010027 | OTCServiceError | Order quantity is less than minimum required quantity | 400 | Order quantity is less than minimum required quantity |
| OT010028 | OTCServiceError | Order quantity is greater than maximum required quantity | 400 | Order quantity is greater than maximum required quantity |
| OT010029 | OTCServiceError | Invalid Quantity Step | 400 | Invalid Quantity Step |
| OT010030 | OTCServiceError | Invalid Price Step | 400 | Invalid Price Step |

### POST Firm Quote v2
Get a firm quote for the desired trading pair. The quote returned by this endpoint can be accepted by calling POST Order if the user wants to place an order and execute a trade.

**HTTP request**
`POST /pdax-institution/v2/trade/quote`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v2/trade/quote'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--data-raw '{
"side": "buy",
"quote_currency": "USDC",
"base_currency": "PHP",
"currency": "PHP",
"quantity": "1000"
}'
```

****Sample Response (200):****
`json
```json
{
    "data": {
        "quote_id": "018fa0b8-b6e0-70e7-ad7e-1a9803695a86",
        "expires_at": "2024-05-22T14:33:46.111Z",
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "buy",
        "base_quantity": 17.18,
        "price": 58.196,
        "total_amount": 1000
    },
    "status": "success"
}
```
`

#### Schema of Body Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| side | string | yes | Counterparty action -- buy or sell |
| quote_currency | string | yes | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | yes | PHP asset |
| currency | string | yes | The currency of which you want to receive |
| quantity | string | yes | Quantity to buy or sell. Note: Quantity step rules apply. |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| quote_id | string | Firm quote reference ID |
| expires_at | string | Quote validity in ISO timestamp. Firm quotes are only valid for 15 seconds. |
| quote_currency | string | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | PHP asset |
| side | string | Counterparty action -- buy or sell |
| base_quantity | decimal | Quantity of the asset you are buying or selling |
| price | decimal | Quoted unit price |
| total_amount | decimal | Total amount |

#### Error Response
**Sample Error Responses**
```json
{ "code": 400, "name": "OTCServiceError", "message": "side must be buy or sell" }
{ "code": 400, "name": "OTCServiceError", "message": "quote_currency is required" }
{ "code": 400, "name": "OTCServiceError", "message": "base_currency is required" }
{ "code": 400, "name": "OTCServiceError", "message": "currency is required" }
{ "code": "OT010003", "name": "OTCServiceError", "message": "Trading Pair cannot be found or has been expired.","requestId":"e80eab34-2a0d-4441-878b-9f4ce2bc99e3" }
{ "code": "OT010008", "message": "Cannot hold specified amounts","requestId": "c09718f0-1387-4f2f-9487-cd85a0a99ab1"}
{ "code": "OT010016", "name": "OTCServiceError", "message": "Asset unavailable", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3"}
{ "code": "OT010026", "name": "OTCServiceError", "message": "Malformed parameters", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3" }
{ "code": "OT010027", "name": "OTCServiceError", "message": "Order quantity is less than minimum required quantity", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3" }
{ "code": "OT010028", "name": "OTCServiceError", "message": "Order quantity is greater than maximum required quantity", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3" }
{ "code": "OT010029", "name": "OTCServiceError", "message": "Invalid Quantity Step", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3" }
{ "code": "OT010030", "name": "OTCServiceError", "message": "Invalid Price Step", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3" }
{ "code": "ServerError", "message": "Invalid UUIDv4 IdempotencyId", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3"}
```

| Code | Name | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| 400 | OTCServiceError | side must be buy or sell | 400 | Invalid side parameter |
| 400 | OTCServiceError | "quote_currency" is required | 400 | Missing quote currency parameter |
| 400 | OTCServiceError | "base_currency" is required | 400 | Missing base currency parameter |
| 400 | OTCServiceError | "currency" is required | 400 | Missing currency parameter |
| OT010003 | OTCServiceError | Trading Pair cannot be found or has been expired | 400 | Invalid quote_currency or base_currency |
| OT010016 | OTCServiceError | Asset unavailable | 400 | Requested asset is not available |
| OT010008 | OTCServiceError | Cannot hold specified amounts | 500 | Insufficient balance or holding capacity |
| OT010026 | OTCServiceError | Malformed parameters | 400 | Invalid currency parameter |
| OT010026 | OTCServiceError | Malformed parameters | 400 | Mismatch between quote_currency and currency parameters |
| OT010027 | OTCServiceError | Order quantity is less than minimum required quantity | 400 | Below minimum order size |
| OT010028 | OTCServiceError | Order quantity is greater than maximum required quantity | 400 | Above maximum order size |
| OT010029 | OTCServiceError | Invalid Quantity Step | 400 | Quantity not matching allowed step size |
| OT010030 | OTCServiceError | Invalid Price Step | 400 | Price not matching allowed step size |
| ServerError | ServerError | Invalid UUIDv4 IdempotencyId | 400 | Invalid idempotency key format |

### POST Order
Accept a firm quote and place an order using this endpoint. If the order is successful, the user has executed a trade.

**HTTP request**
`POST /pdax-institution/v1/trade`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v1/trade'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--data-raw '{
"quote_id": "a7547037-a3eb-4380-b45d-4d92b801ab67",
"side": "sell",
"idempotency_id": "0188b945-1111-1111-9fea-bfcc2ac25c8c"
}'
```

****Sample Response (200):****
`json
```json
{
    "data": {
        "order_id": 122121,
        "status": "successful",
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "sell",
        "base_quantity": 100,
        "price": 55,
        "total_amount": 5500,
        "created_at" : "2023-06-14T09:41:00.423874Z",
        "updated_at" : "2023-06-14T09:41:00.423874Z"
    },
    "status": "success"
}
```
`

#### Schema of Body Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| quote_id | string | yes | Id of the firm quote you want to accept. This id is returned by POST Firm Quote or POST Firm Quote v2 |
| side | string | yes | Counterparty action -- buy or sell |
| idempotency_id | string | yes | User-generated id for the order. You may generate an idempotency id by using uuid ver 4 format. Sample can be found here: https://www.uuidgenerator.net/version4 |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| order_id | number | Order ID |
| status | string | Possible Values : successful, failed, IN PROGRESS |
| quote_currency | string | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | PHP asset |
| side | string | Counterparty action -- buy or sell |
| base_quantity | decimal | Order quantity as per firm quote |
| price | decimal | Quoted unit price |
| total_amount | decimal | Total amount |
| created_at | string | Created time of order |
| updated_at | string | Updated time of order |

#### Error Response
**Sample Error Responses**
```json
{ "code": 400, "message": "quote_id is not allowed to be empty" }
{ "code": 400, "message": "side is not allowed to be empty" }
{ "code": 400, "message": "idempotency_id is not allowed to be empty" }
{ "code": 400, "message": "side must be one of [buy, sell]" }
{ "code": "OT010003", "message": "Order Quote cannot be found or has been expired.", "requestId": "6b91708-e6ea-434f-9a90-d8829f59a695" }
{ "code": "OT010008", "message": "Cannot hold specified amounts", "requestId": "c09718f0-1387-4f2f-9487-cd85a0a99ab1" }
{ "code": "ServerError", "message": "Duplicate Request with ID: 417699ae-c57a-4304-bf44-b75faf5a4d7f", "requestId": "511ec40a-7cf8-455f-aaf8-e74a77347128" }
{ "code": "ServerError", "message": "Invalid UUIDv4 IdempotencyId", "requestId": "e80eab34-2a0d-4441-878b-9f4ce2bc99e3" }
```

| Code | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| 400 | "quote_id" is not allowed to be empty | 400 | Missing quote_id parameter |
| 400 | "side" is not allowed to be empty | 400 | Missing side parameter |
| 400 | "idempotency_id" is not allowed to be empty | 400 | Missing idempotency_id parameter |
| 400 | "side" must be one of [buy, sell] | 400 | Invalid side value |
| OT010003 | Order Quote cannot be found or has been expired. | 400 | Invalid or expired order quote |
| OT010008 | Cannot hold specified amounts | 500 | Insufficient balance or holding capacity |
| ServerError | Duplicate Request with ID: {{idempotency_id}} | 400 | Duplicate idempotency_id detected |
| ServerError | Invalid UUIDv4 IdempotencyId | 400 | Invalid idempotency key format |

### GET Order Details
Use this endpoint to get the details of a specific order.

**HTTP request**
`GET /pdax-institution/v1/orders/{order_id}`

**Sample Request:**
```bash
curl --location --request GET 'https://API_DOMAIN/v1/orders/122121'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'
```

****Sample Response (200):****
`json
```json
{
    "data": {
        "order_id": 122121,
        "status": "SUCCESSFUL",
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "sell",
        "base_quantity": 100,
        "price": 55,
        "total_amount": 5500,
        "created_at": "2025-06-12T07:34:00.155Z"
    },
    "status": "success"
}
```
`

#### Schema of Path Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| order_id | string | yes | Order ID of the order you want to get the details of. This ID is returned by POST Order |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| order_id | number | Order ID |
| status | string | Possible Values : SUCCESSFUL, FAILED, IN PROGRESS |
| quote_currency | string | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | PHP asset |
| side | string | Counterparty action -- buy or sell |
| base_quantity | decimal | Order quantity as per firm quote |
| price | decimal | Quoted unit price |
| total_amount | decimal | Total amount |

#### Error Response
**Sample Error Response**
```json
{
    "requestId": "4dcebac9-173a-40f3-a3bc-8fa31ba59c02",
    "code": "ValidationError",
    "details": [
        {
            "message": "orderId must be a number",
            "key": "orderId"
        }
    ]
}
```

| Code | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| ValidationError | orderId must be a number | 400 | orderId must be a number |

### GET Orders
Use this endpoint to get list of your orders and details for each order.

**HTTP request**
`GET /pdax-institution/v1/orders`

**Sample Request:**
```bash
curl --location --request GET 'https://API_DOMAIN/v1/orders?page=1&pageSize=10&startDate=2025-06-01&endDate=2025-06-20'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'
```

****Sample Response (200):****
`json
```json
{
"data": [
    {
        "order_id": 122121,
        "status": "SUCCESSFUL",
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "sell",
        "base_quantity": 100,
        "price": 55,
        "total_amount": 5500,
        "created_at": "2025-06-12T07:34:00.155Z"
    },
    {
        "order_id": 122122,
        "status": "SUCCESSFUL",
        "quote_currency": "USDC",
        "base_currency": "PHP",
        "side": "sell",
        "base_quantity": 100,
        "price": 55,
        "total_amount": 5500,
        "created_at": "2025-06-12T07:34:00.155Z"
    }
],
"status": "success"
}
```
`

#### Schema of Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| page | string | yes | page |
| pageSize | string | yes | item per page |
| startDate | string | no | start date for filter order. Format YYYY-MM-DD |
| endDate | string | no | end date for filter order. Format YYYY-MM-DD |

#### Schema of Response Payload
| Key | Type | Description |
| :--- | :--- | :--- |
| order_id | number | Order ID |
| status | string | Possible Values : SUCCESSFUL, FAILED, IN PROGRESS |
| quote_currency | string | The crypto asset you want to buy or sell. Supported trading pairs can be found here. |
| base_currency | string | PHP asset |
| side | string | Counterparty action -- buy or sell |
| base_quantity | decimal | Order quantity as per firm quote |
| price | decimal | Quoted unit price |
| total_amount | decimal | Total amount |

#### Error Response
**Sample Error Responses**
```json
{"code": 400, "message": "\"page\" is required"}
{"code": 400, "message": "\"pageSize\" is required"}
{"code": 400, "message": "\"page\" must be a number"}
{"code": 400, "message": "\"pageSize\" must be a number"}
{"code": 400, "message": "Invalid Date. Please input date with format YYYY-MM-DD"}
{"code": 400, "message": "Invalid Date. Please input date with format YYYY-MM-DD"}
```

| Code | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| 400 | "page" is required | 400 | Missing page parameter |
| 400 | "pageSize" is required | 400 | Missing pageSize parameter |
| 400 | "page" must be a number | 400 | Invalid page parameter format |
| 400 | "pageSize" must be a number | 400 | Invalid pageSize parameter format |
| 400 | Invalid Date. Please input date with format YYYY-MM-DD | 400 | Invalid startDate format |
| 400 | Invalid Date. Please input date with format YYYY-MM-DD | 400 | Invalid endDate format |

## Funding

### GET Wallet Address - for Crypto Deposits
Deposit crypto into your PDAX account using the wallet address returned by this endpoint.

**HTTP Request**
`GET /pdax-institution/v1/crypto/deposit`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v1/crypto/deposit?currency=USDCXLM'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'
```

****Sample Response (200):****
`json
```json
{
    "data": {
        "currency": "USDCXLM",
        "address": "GA54SPC34JL3I57ENALTO2V26XOFFG4VGQLFQXDGF6KJ5TJY7ODY56ST",
        "tag": "123123123"
    },
    "status": "success"
}
```
`

#### Schema of Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| currency | string | yes | Currency symbol including network of crypto token e.g USDCXLM |

#### Schema of Response Payload
Returns a list of wallet addresses with the following keys:

| Key | Type | Description |
| :--- | :--- | :--- |
| currency | string | Currency symbol |
| address | string | Wallet address |
| tag | string | Address tag or memo |

#### Error Response
**Sample Error Responses**
```json
{ "code": 400, "message": "\"currency\" is required"}
{"code": "FailedRetrievingWallet",  "message": "Failed retrieving USDCXLM wallet."}
```

| Code | Message | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| 400 | ""currency" is required" | 400 | "Currency is required" |
| FailedRetrievingWallet | "Failed retrieving {{currency}} wallet." | 400 | Failed retrieving {{currency}} wallet. |

### POST Fiat Deposit
Deposit fiat into your PDAX account using this endpoint.

**HTTP Request**
`POST /pdax-institution/v1/fiat/deposit`

**Sample Request:**
```bash
curl --location --request POST 'https://API_DOMAIN/pdax-institution/v1/fiat/deposit'\
--header 'access_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--header 'id_token: eyJraWQiOiJDZEVOVnNTdWJRS09saG9lQTVvOT...'\
--data-raw '{
"amount": "48000",
"method": "instapay_upay_cashin",
"sender_first_name": "John",
"sender_middle_name": "Doe",
"sender_last_name": "Smith",
"sender_country_origin": "Philippines",
"sender_address_line_one": "123 Elm Street",
"sender_address_line_two": "Ortigas Center",
"sender_city": "Pasig City",
"sender_province": "Metro Manila",
"sender_country": "Philippines",
"sender_zip_code": "1001",
"sender_phone_number": "6391712345678",
"sender_nationality": "Philippines",
"sender_national_identity_number": "12FKEMT840F",
"sender_dob": "12-29-1990",
"sender_place_of_birth": "Quezon City",
"source_of_funds": "Others: Sample",
"sender_email": "johndoesmith@gmail.com",
"beneficiary_first_name": "Steve",
"beneficiary_middle_name": "Mario",
"beneficiary_last_name": "De La Cruz",
"beneficiary_sex": "Male",
"beneficiary_nationality": "Philippines",
"beneficiary_dob": "04-30-1991",
"beneficiary_address_line_one": "567 32nd Street",
"beneficiary_address_line_two": "Bonifacio Global City",
"beneficiary_barangay": "Barangay Culiat",
"beneficiary_city": "Taguig",
"beneficiary_province": "Metro Manila",
"beneficiary_country": "Philippines",
"beneficiary_zip_code": "2002",
"beneficiary_government_issued_id": "ID123",
"beneficiary_phone_number": "6390812345678",
"purpose": "Family Support",
"relationship_of_sender_to_beneficiary": "Myself",
"currency": "PHP",
"nature_of_business": "Allowances"
}'
```

****Sample Response (200):****
`json
```json
{
    "request_id": "a3bb3030-6974-11ed-998b-ef1ff47430fe",
    "identifier": "Zek_141",
    "reference_number": "eyJ0IjoiYW54IiwibSI6ImNpIiwiciI6ImVTaUNCa1hXIn0=",
    "amount": 48000,
    "method": "instapay_upay_cashin",
    "payment_checkout_url": "https://test-sources.paymongo.com/sources?id=src_ccURUdNjV9zjBsbph4rDZ6Bu",
    "fee": 30,
    "status": "PENDING"
}
```
`

[Note: The rest of the documentation was truncated. Please provide the remaining content.]