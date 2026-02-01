


export type BenefitCategory = 'Shopping' | 'Food' | 'Entertainment' | 'Fuel' | 'Forex' | 'Travel' | 'Other';
export type CardCategory = 'Credit' | 'Debit';
export type AppTheme = 
  | 'Slate' 
  | 'Gray' 
  | 'Red' 
  | 'Orange' 
  | 'Amber' 
  | 'Yellow' 
  | 'Lime' 
  | 'Green' 
  | 'Emerald' 
  | 'Teal' 
  | 'Cyan' 
  | 'Sky' 
  | 'Blue' 
  | 'Indigo' 
  | 'Violet' 
  | 'Purple' 
  | 'Fuchsia' 
  | 'Pink' 
  | 'Rose';

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
  status: 'active' | 'expired';
  customSkin?: string; // Base64 image data for custom card background
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
  status: 'active' | 'expired';
  customSkin?: string;
}

export interface BackupPayload {
  version: number;
  timestamp: number;
  data: CreditCard[];
  settings?: {
    notificationPeriod?: number;
    proStatus?: boolean;
    advisorUsage?: { month: string; count: number };
    theme?: AppTheme;
  };
}

export type AdvisorDecision = "APPLY" | "SKIP" | "OPTIONAL" | "MANUAL";

export interface MultiAdvisorResult {
  card: string;
  decision: AdvisorDecision;
  reason: string;
  newValue: string[];
  alreadyCovered: {
    benefit: string;
    coveredBy: string[];
  }[];
}
