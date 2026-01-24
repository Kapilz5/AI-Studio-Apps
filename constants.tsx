import React from 'react';
import { ShoppingCart, Utensils, Film, Fuel, Globe, Plane, Star } from 'lucide-react';
import { BenefitCategory } from './types';

export const CategoryIcon: React.FC<{ category: BenefitCategory }> = ({ category }) => {
  switch (category) {
    case 'Shopping': return <ShoppingCart size={18} />;
    case 'Food': return <Utensils size={18} />;
    case 'Entertainment': return <Film size={18} />;
    case 'Fuel': return <Fuel size={18} />;
    case 'Forex': return <Globe size={18} />;
    case 'Travel': return <Plane size={18} />;
    case 'Other':
    default:
      return <Star size={18} />;
  }
};

export const CATEGORY_COLORS: Record<BenefitCategory, string> = {
  Shopping: 'bg-blue-100 text-blue-700',
  Food: 'bg-orange-100 text-orange-700',
  Entertainment: 'bg-purple-100 text-purple-700',
  Fuel: 'bg-amber-100 text-amber-700',
  Forex: 'bg-emerald-100 text-emerald-700',
  Travel: 'bg-indigo-100 text-indigo-700',
  Other: 'bg-slate-100 text-slate-700',
};

export const CATEGORIES: BenefitCategory[] = ['Shopping', 'Food', 'Entertainment', 'Fuel', 'Forex', 'Travel', 'Other'];