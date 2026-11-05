# Chroma Studio — Razorpay Setup & Production Deployment Guide

This guide details the step-by-step instructions to configure Razorpay payments, apply database migrations, deploy Supabase Edge Functions, and verify end-to-end subscription workflows in both Sandbox and Live production modes.

---

## 1. Prerequisites & Credentials

Sign in to your [Razorpay Dashboard](https://dashboard.razorpay.com).

1. Navigate to **Account & Settings** → **API Keys**.
2. Generate or retrieve:
   - **Key Id** (e.g. `rzp_test_...` or `rzp_live_...`)
   - **Key Secret** (e.g. `xxxxxxxxxxxxxxxxxxxx`)
3. Navigate to **Account & Settings** → **Webhooks**.
   - Note or set your **Webhook Secret**.

> [!CAUTION]
> **Zero Client Secret Exposure:** Never put `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` into frontend `.env`, `Vite` environment variables, or client bundle code. They are strictly server-side secrets read exclusively by Supabase Edge Functions.

---

## 2. Apply Database Migration

The subscription and payment auditing schema is located at:
`supabase/migrations/20261105_phase9_subscriptions_and_razorpay.sql`

It creates:
- `public.subscriptions`: Stores plan, interval, active periods, status, and cancellation flags.
- `public.payment_events`: Idempotent audit log for all payment and webhook transactions.
- **Row Level Security (RLS)**: Authenticated users can only `SELECT` their own records (`auth.uid() = user_id`). Direct client `INSERT`, `UPDATE`, and `DELETE` permissions are strictly revoked. Only the trusted `service_role` (Edge Functions) can mutate records.
- Functions & Triggers: `public.is_user_pro(UUID)` and auto-updating `profiles.role` sync trigger.

### How to apply:
**Option A: Via Supabase Dashboard (Recommended)**
1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/fbtiigdfglailzjzfryp).
2. Go to **SQL Editor** → **New query**.
3. Copy the entire contents of `supabase/migrations/20261105_phase9_subscriptions_and_razorpay.sql` and click **Run**.

**Option B: Via Supabase CLI**
```powershell
npx supabase db push
```

---

## 3. Set Supabase Edge Function Secrets

Configure your Razorpay credentials in Supabase project secrets so the Edge Functions can sign and verify transactions.

Run the following command in PowerShell / Terminal:
```powershell
npx supabase secrets set `
  RAZORPAY_KEY_ID="rzp_test_YOUR_KEY_ID" `
  RAZORPAY_KEY_SECRET="YOUR_KEY_SECRET" `
  RAZORPAY_WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET" `
  --project-ref fbtiigdfglailzjzfryp
```

To verify active secrets:
```powershell
npx supabase secrets list --project-ref fbtiigdfglailzjzfryp
```

---

## 4. Deploy Supabase Edge Functions

Deploy the 4 subscription and payment lifecycle Edge Functions:

```powershell
# 1. Order Creation
npx supabase functions deploy create-subscription --project-ref fbtiigdfglailzjzfryp

# 2. Payment Verification & Signature Checking
npx supabase functions deploy verify-payment --project-ref fbtiigdfglailzjzfryp

# 3. Webhook Event Processing & Idempotency
npx supabase functions deploy razorpay-webhook --project-ref fbtiigdfglailzjzfryp --no-verify-jwt

# 4. Subscription Status & Auto-Expiry Check
npx supabase functions deploy get-subscription --project-ref fbtiigdfglailzjzfryp
```

> [!NOTE]
> `razorpay-webhook` must be deployed with `--no-verify-jwt` because Razorpay webhook servers deliver notifications as HTTP POST requests with signature headers (`X-Razorpay-Signature`), rather than Supabase user JWT tokens.

---

## 5. Configure Razorpay Webhook in Dashboard

1. In the [Razorpay Dashboard](https://dashboard.razorpay.com), go to **Account & Settings** → **Webhooks** → **Add New Webhook**.
2. **Webhook URL**:
   ```
   https://fbtiigdfglailzjzfryp.supabase.co/functions/v1/razorpay-webhook
   ```
3. **Secret**: Enter the exact secret string you set in `RAZORPAY_WEBHOOK_SECRET`.
4. **Active Events**: Select the following subscription & payment lifecycle events:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`
   - `subscription.charged`
   - `subscription.cancelled`
   - `refund.processed`
5. Click **Save**.

---

## 6. Testing End-to-End Flow

### 6.1 Testing with Razorpay Test Mode
1. In `UpgradeModal.tsx`, select either:
   - **Pro Monthly** (₹99/mo)
   - **Pro Yearly** (₹599/yr)
2. Click **Subscribe with Razorpay**.
3. In the Razorpay modal, select **UPI** or **Cards**:
   - **Test Card**: `4012 0010 3714` (Expiry: Any future date, CVV: `123`)
   - **Test UPI**: `success@razorpay`
4. Complete the simulated authorization.
5. Verification:
   - The UI automatically verifies HMAC SHA-256 signature via `verify-payment`.
   - A success banner appears, unlocking Pro features immediately.
   - The user profile displays the **CHROMA PRO** badge.
   - `public.subscriptions` table reflects `status = 'active'` and future `current_period_end`.

### 6.2 Testing Feature Gating
| Test Case | Free Tier Expected | Pro Tier Expected |
| :--- | :--- | :--- |
| **AI Image Gen** | Opens Upgrade Modal explaining Pro benefits | Generates AI image via Edge Function |
| **Background Replacement (AI)** | Opens Upgrade Modal | Synthesizes custom AI backdrop |
| **Inpainting (Cloud AI)** | Opens Upgrade Modal (On-device remains free) | Runs Cloud AI generative inpainting |
| **AI Enhancement (Cloud AI)** | Opens Upgrade Modal (On-device remains free) | Runs deep multi-zone photometric enhancement |
| **Export Resolution** | Standard scale (1x, 0.5x, 75%) | 4K Ultra (2x) and Lossless uncompressed exports |

---

## 7. Switching to Live Production Mode

When you are ready to accept real payments:
1. In Razorpay Dashboard, toggle from **Test Mode** to **Live Mode**.
2. Generate Live API Keys (`rzp_live_...`).
3. Update Supabase secrets:
   ```powershell
   npx supabase secrets set `
     RAZORPAY_KEY_ID="rzp_live_YOUR_LIVE_KEY_ID" `
     RAZORPAY_KEY_SECRET="YOUR_LIVE_KEY_SECRET" `
     RAZORPAY_WEBHOOK_SECRET="YOUR_LIVE_WEBHOOK_SECRET" `
     --project-ref fbtiigdfglailzjzfryp
   ```
4. Update the Webhook endpoint in the Live mode dashboard to point to `https://fbtiigdfglailzjzfryp.supabase.co/functions/v1/razorpay-webhook`.
