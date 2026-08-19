# GHL Automator — Endpoint Reference

Base URL: `https://automator-subuser.vercel.app`

All action endpoints follow the GHL Custom Action pattern:
- Respond `200` immediately (GHL requires this within 10 s)
- Do the work asynchronously
- POST results back to `callbackUrl`

---

## Installation

### POST /install

Register both PITs (Private Integration Tokens) for a sub-location. Must be done once before any action endpoints will work.

**Request body:**

| Field | Required | Description |
|---|---|---|
| `locationId` | ✅ | The sub-location ID on Account 1 |
| `subLocationApiKey` | ✅ | PIT from Account 1 sub-location — needs `contacts.readonly` + `contacts.write` |
| `agencyApiKey` | ✅ | PIT from Account 2 agency — needs `locations.write` + `users.write` |

**Response:** `{ ok: true, locationId }`

---

### GET /install/:locationId

Check whether a sub-location is registered.

**Response:** `{ locationId, registered: true/false }`

---

### DELETE /install/:locationId

Remove a sub-location registration.

---

## Actions

All actions accept fields in **two formats** — whichever GHL sends:

1. **GHL workflow format** — `{ locationId, callbackUrl, fields: [{ key, value }, ...] }`
2. **Direct JSON** — flat object with all fields at the top level

The `locationId` at the top level (or `x-ghl-location-id` header) is the **trigger** sub-location on Account 1 — used to look up the stored PITs. It is not necessarily the sub-location being operated on.

---

### GET /action

Health check. Returns a list of all available actions.

---

### 1. POST /action/create-location

Creates a new sub-location (sub-account) on Account 2, then optionally writes the new `locationId` back to a contact custom field on Account 1.

**Required fields:**

| Field | Description |
|---|---|
| `locationId` | Trigger sub-location ID (Account 1) |
| `callbackUrl` | GHL callback URL |
| `companyId` | Account 2 company ID |
| `name` or `locationName` | Display name for the new sub-location |
| `email` or `locationEmail` | Owner email for the new sub-location |

**Optional fields:**

| Field | Description |
|---|---|
| `firstName` / `locationFirstName` | Owner first name |
| `lastName` / `locationLastName` | Owner last name |
| `phone` / `locationPhone` | Sub-location phone |
| `address` / `locationAddress` | Street address |
| `city` / `locationCity` | City |
| `state` / `locationState` | State |
| `country` / `locationCountry` | Country code (default: `US`) |
| `postalCode` / `locationPostalCode` | ZIP / postal code |
| `timezone` / `locationTimezone` | Timezone string |
| `website` / `locationWebsite` | Website URL |
| `allowDuplicateContact` | `true` / `false` (default `false`) |
| `allowDuplicateOpportunity` | `true` / `false` (default `false`) |
| `allowFacebookNameMerge` | `true` / `false` (default `false`) |
| `disableContactTimezone` | `true` / `false` (default `false`) |
| `sourceContactId` | Contact on Account 1 to write the new `locationId` back to |
| `sourceCustomFieldId` | Custom field ID or key to store the new `locationId` |

**Callback outputs:**

| Field | Description |
|---|---|
| `locationId` | New sub-location ID |
| `locationName` | New sub-location name |

---

### 2. POST /action/create-user

Creates a user on Account 2 and assigns them to a sub-location. If a user with that email already exists, the action **updates** the existing user instead of erroring.

**Required fields:**

| Field | Description |
|---|---|
| `locationId` | Trigger sub-location ID (Account 1) |
| `callbackUrl` | GHL callback URL |
| `companyId` | Account 2 company ID |
| `firstName` | User first name |
| `lastName` | User last name |
| `email` | User email |

**Optional fields:**

| Field | Default | Description |
|---|---|---|
| `password` | Auto-generated (24 chars) | Leave blank — server generates a secure password |
| `locationIds` | Trigger `locationId` | Sub-location(s) to assign user to. Map to `{{action.create-location.locationId}}` |
| `phone` | — | User phone |
| `type` | `account` | `account` or `agency` |
| `role` | `admin` | `user` or `admin` |
| `platformLanguage` | `en_US` | Language preference |
| `scopes` | — | Comma-separated or array of OAuth scopes |
| `scopesAssignedToOnly` | — | Comma-separated or array |
| `sourceContactId` | — | Contact on Account 1 to write the generated password back to |
| `passwordFieldId` | — | Custom field ID to store the generated password |

**Permission flags** (all default `true` unless noted):

`campaignsEnabled`, `contactsEnabled`, `workflowsEnabled`, `triggersEnabled`, `funnelsEnabled`, `opportunitiesEnabled`, `dashboardStatsEnabled`, `bulkRequestsEnabled`, `appointmentsEnabled`, `reviewsEnabled`, `onlineListingsEnabled`, `phoneCallEnabled`, `conversationsEnabled`, `settingsEnabled`, `tagsEnabled`, `leadValueEnabled`, `marketingEnabled`, `agentReportingEnabled`, `socialPlanner`, `bloggingEnabled`, `invoiceEnabled`, `affiliateManagerEnabled`, `contentAiEnabled`, `refundsEnabled`, `recordPaymentEnabled`, `cancelSubscriptionEnabled`, `paymentsEnabled`, `communitiesEnabled`, `exportPaymentsEnabled`

Default `false`: `campaignsReadOnly`, `websitesEnabled`, `assignedDataOnly`, `adwordsReportingEnabled`, `membershipEnabled`, `facebookAdsReportingEnabled`, `attributionsReportingEnabled`, `botService`

**Callback outputs:**

| Field | Description |
|---|---|
| `userId` | User ID (new or updated) |
| `userEmail` | User email |
| `password` | The password (auto-generated or provided) |
| `action` | `created` or `updated` |
| `locationIds` | Location(s) the user was assigned to |

---

### 3. POST /action/update-contact

Finds a contact by email on Account 1 and updates their custom fields and/or DND status.

**Required fields:**

| Field | Description |
|---|---|
| `locationId` | Trigger sub-location ID (Account 1 — where the contact lives) |
| `callbackUrl` | GHL callback URL |
| `email` | Contact email — must match exactly |

**Optional fields:**

| Field | Description |
|---|---|
| `subaccountId` | Value to write to the `subaccount_id` custom field. Map to `{{action.create-location.locationId}}` |
| `dnd` | `true` / `false` — enable or disable Do Not Disturb |
| `passwordFieldId` + `password` | Write a password value to a specific custom field ID |
| `customFields` | Array of `{ id, key, value }` — arbitrary custom field updates |

**Callback outputs:**

| Field | Description |
|---|---|
| `contactId` | GHL contact ID |
| `email` | Contact email |
| `locationId` | Sub-location the contact belongs to |

---

### 4. POST /action/get-saas-subscription

Fetches the SaaS subscription details for a sub-account.

> **Note:** Scope: `saas/company.read`. Uses GHL SaaS API `Version: v3` with an Agency Token. The underlying GHL call is a **GET** request.

**GHL API:** `GET https://services.leadconnectorhq.com/saas/get-saas-subscription/:locationId?companyId=...`

**Required fields:**

| Field | Description |
|---|---|
| `locationId` | Trigger sub-location ID (Account 1) |
| `callbackUrl` | GHL callback URL |
| `targetLocationId` | Sub-account whose subscription to fetch (also accepts `subLocationId`) |
| `companyId` | Account 2 company ID |

**Callback outputs:**

| Field | Description |
|---|---|
| `locationId` | The sub-account queried |
| `subscriptionId` | Subscription ID |
| `planId` | SaaS plan ID |
| `priceId` | Stripe price ID |
| `status` | Subscription status (e.g. `active`, `trialing`) |
| `trialDays` | Trial days remaining |
| `stripeCustomerId` | Stripe customer ID |
| `raw` | Full raw response from GHL |

---

### 5. POST /action/enable-saas

Enables SaaS on a sub-account. Supports both SaaS V2 (recommended) and SaaS V1 (Stripe direct).

> **Note:** Requires Agency Pro ($497/mo) GHL plan. Scope: `saas/company.write`. Uses GHL SaaS API `Version: v3` with an Agency Token.

**GHL API:** `POST https://services.leadconnectorhq.com/saas/enable-saas/:locationId`

**Required fields:**

| Field | Type | Description |
|---|---|---|
| `locationId` | string | Trigger sub-location ID (Account 1) — used to look up stored Agency Token |
| `callbackUrl` | string | GHL callback URL |
| `targetLocationId` | string | Sub-account to enable SaaS on. Map to `{{action.create-location.locationId}}` |
| `companyId` | string | Account 2 company ID |
| `isSaaSV2` | boolean | `true` for SaaS V2 (recommended), `false` for SaaS V1 |

**SaaS V2 — optional:**

| Field | Type | Description | Example |
|---|---|---|---|
| `contactId` | string | Agency contact used for payment provider integration | `1QDPY5FpU9DlKp7RQ8BXfywx` |
| `providerLocationId` | string | Agency sub-account ID | `r06mdj4OrrERzYDvsOdh` |

**SaaS V1 — required when `isSaaSV2` is `false`:**

| Field | Type | Description | Example |
|---|---|---|---|
| `stripeAccountId` | string | Stripe account ID | `acct_1QDPY5FpU9DlKp7RQ8BXfywx` |
| `name` | string | Stripe customer name | `John Doe` |
| `email` | string | Stripe customer email | `john.doe@example.com` |
| `stripeCustomerId` | string | Existing Stripe customer ID (optional) | `cus_1QDPY5FpU9DlKp7RQ8BXfywx` |

**Optional for both V1 and V2:**

| Field | Type | Description | Example |
|---|---|---|---|
| `saasPlanId` | string | Pre-configure the SaaS subscription plan (e.g. your $297/mo plan ID) | `1QDPY5FpU9DlKp7RQ8BXfywx` |
| `priceId` | string | Pre-configure the Stripe price ID | `price_1QDPY5FpU9DlKp7RQ8BXfywx` |
| `description` | string | Description | `Automator 365 HIPAA` |

**Callback outputs:**

| Field | Description |
|---|---|
| `locationId` | The sub-account that was enabled |
| `isSaaSV2` | Whether V2 was used |

**Example payload (SaaS V2):**

```json
{
  "locationId": "{{triggerLocationId}}",
  "callbackUrl": "{{callbackUrl}}",
  "targetLocationId": "{{action.create-location.locationId}}",
  "companyId": "your_company_id",
  "isSaaSV2": true,
  "contactId": "1QDPY5FpU9DlKp7RQ8BXfywx",
  "providerLocationId": "r06mdj4OrrERzYDvsOdh",
  "saasPlanId": "1QDPY5FpU9DlKp7RQ8BXfywx",
  "priceId": "price_1QDPY5FpU9DlKp7RQ8BXfywx"
}
```

**Example payload (SaaS V1):**

```json
{
  "locationId": "{{triggerLocationId}}",
  "callbackUrl": "{{callbackUrl}}",
  "targetLocationId": "{{action.create-location.locationId}}",
  "companyId": "your_company_id",
  "isSaaSV2": false,
  "stripeAccountId": "acct_1QDPY5FpU9DlKp7RQ8BXfywx",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "stripeCustomerId": "cus_1QDPY5FpU9DlKp7RQ8BXfywx",
  "saasPlanId": "1QDPY5FpU9DlKp7RQ8BXfywx",
  "priceId": "price_1QDPY5FpU9DlKp7RQ8BXfywx"
}
```

---

## Typical Workflow Sequence

```
1. POST /install                    — one-time setup per sub-location
2. POST /action/create-location     — creates the sub-account on Account 2
3. POST /action/create-user         — creates the user, assigns to new sub-account
4. POST /action/update-contact      — writes locationId + password back to origin contact
5. POST /action/enable-saas         — enables SaaS with chosen plan
6. POST /action/get-saas-subscription — verify subscription is active
```

Each step maps `{{action.previous-step.outputField}}` in GHL to pass data forward.
