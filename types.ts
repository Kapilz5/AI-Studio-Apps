

export type BenefitCategory = 'Shopping' | 'Food' | 'Entertainment' | 'Fuel' | 'Forex' | 'Travel' | 'Other';
export type CardCategory = 'Credit' | 'Debit';

export interface Benefit {
  id: string;
  category: BenefitCategory;
  detail: string;
}

export interface CreditCard {
  id: string;
  name: string;
  cardCategory: CardCategory;
  cardType: string; // Network brand: Visa, Mastercard, Amex, Discover, RuPay
  fullNumber: string;
  last4: string;
  cvv: string;
  issueDate: string; // ISO String
  expiryMonth: number;
  expiryYear: number;
  annualFee: number;
  creditLimit: number;
  waiverCondition: string;
  waiverTarget: number;
  currentSpend: number;
  bestOffer?: string;
  benefits: Benefit[];
}

export interface CardFormData {
  name: string;
  cardCategory: CardCategory;
  cardType: string;
  fullNumber: string;
  last4: string;
  cvv: string;
  issueDate: string;
  expiryMonth: number;
  expiryYear: number;
  annualFee: number;
  creditLimit: number;
  waiverCondition: string;
  waiverTarget: number;
  currentSpend: number;
  bestOffer?: string;
}

export interface BackupPayload {
  version: number;
  timestamp: number;
  data: CreditCard[];
}

export type AdvisorDecision = "APPLY" | "SKIP" | "OPTIONAL" | "MANUAL";

export interface MultiAdvisorResult {
  card: string;
  decision: AdvisorDecision;
  reason: string;
  covered: string[];
  newValue: string[];
}
