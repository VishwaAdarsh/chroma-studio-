// Chroma Studio - Pro Subscription & Razorpay Types

export type SubscriptionPlan = 'free' | 'pro_monthly' | 'pro_yearly';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'incomplete'
  | 'none';

export type EntitlementFeature =
  | 'ai_assistant_unlimited'
  | 'ai_enhancement_pro'
  | 'ai_inpaint_unlimited'
  | 'ai_cutout_pro'
  | 'ai_background_gen'
  | 'ai_image_gen'
  | 'smart_presets_multimodal'
  | 'cloud_storage_10gb'
  | 'export_4k_lossless'
  | 'pro_templates';

export interface PlanDetails {
  id: 'pro_monthly' | 'pro_yearly';
  name: string;
  priceInr: number;
  displayPrice: string;
  periodLabel: string;
  billingInterval: 'month' | 'year';
  savingsBadge?: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<'pro_monthly' | 'pro_yearly', PlanDetails> = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    priceInr: 99,
    displayPrice: '₹99',
    periodLabel: 'per month',
    billingInterval: 'month',
    features: [
      'Unlimited AI Photo Editing Assistant',
      'Cloud AI Deep Photo Enhancement',
      'Generative Inpainting & Object Removal',
      'AI Background Scene Synthesis',
      '50 Text-to-Image Generations / month',
      'Full Original & Ultra 4K Exports',
      '100+ Pro Templates & Carousels',
      '10 GB Cloud Storage & Sync',
    ],
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    priceInr: 599,
    displayPrice: '₹599',
    periodLabel: 'per year (~₹49.90/mo)',
    billingInterval: 'year',
    savingsBadge: 'SAVE 50%',
    features: [
      'All Pro Monthly features included',
      '50% discount compared to monthly plan',
      'Priority GPU processing queues',
      'Early access to next-gen AI models',
      'Priority creator support',
      'Uninterrupted 12-month access',
    ],
  },
};

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_interval: 'month' | 'year' | 'none';
  amount_inr: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RazorpayOrderResponse {
  success: boolean;
  mode: 'live' | 'test';
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  plan: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
  };
  customer: {
    id: string;
    email: string;
    name: string;
  };
}

export interface PaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  planId: 'pro_monthly' | 'pro_yearly';
}

export interface PaymentVerificationResponse {
  success: boolean;
  entitlement: 'pro';
  plan: 'pro_monthly' | 'pro_yearly';
  status: 'active';
  current_period_end: string;
  error?: string;
}
