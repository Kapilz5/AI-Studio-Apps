

import React from 'react';
import { ShoppingCart, Utensils, Film, Fuel, Globe, Plane, Star } from 'lucide-react';
import { BenefitCategory, AppTheme } from './types';

export const CATEGORY_ICONS: Record<BenefitCategory, React.ReactNode> = {
  Shopping: <ShoppingCart size={18} />,
  Food: <Utensils size={18} />,
  Entertainment: <Film size={18} />,
  Fuel: <Fuel size={18} />,
  Forex: <Globe size={18} />,
  Travel: <Plane size={18} />,
  Other: <Star size={18} />,
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

// Theme Definitions: Primary (maps to 'blue') and Secondary (maps to 'indigo')
export const THEME_PALETTES: Record<AppTheme, { primary: Record<number, string>, secondary: Record<number, string> }> = {
  Blue: {
    primary: { // Tailwind Blue
      50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253', 400: '96 165 250',
      500: '59 130 246', 600: '37 99 235', 700: '29 78 216', 800: '30 64 175', 900: '30 58 138', 950: '23 37 84'
    },
    secondary: { // Tailwind Indigo
      50: '238 242 255', 100: '224 231 255', 200: '199 210 254', 300: '165 180 252', 400: '129 140 248',
      500: '99 102 241', 600: '79 70 229', 700: '67 56 202', 800: '55 48 163', 900: '49 46 129', 950: '30 27 75'
    }
  },
  Purple: {
    primary: { // Tailwind Violet
      50: '245 243 255', 100: '237 233 254', 200: '221 214 254', 300: '196 181 253', 400: '167 139 250',
      500: '139 92 246', 600: '124 58 237', 700: '109 40 217', 800: '91 33 182', 900: '76 29 149', 950: '46 16 101'
    },
    secondary: { // Tailwind Fuchsia
      50: '253 244 255', 100: '250 232 255', 200: '245 208 254', 300: '240 171 252', 400: '232 121 249',
      500: '217 70 239', 600: '192 38 211', 700: '162 28 175', 800: '134 25 143', 900: '112 26 117', 950: '74 4 78'
    }
  },
  Emerald: {
    primary: { // Tailwind Emerald
      50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183', 400: '52 211 153',
      500: '16 185 129', 600: '5 150 105', 700: '4 120 87', 800: '6 95 70', 900: '6 78 59', 950: '2 44 34'
    },
    secondary: { // Tailwind Teal
      50: '240 253 250', 100: '204 251 241', 200: '153 246 228', 300: '94 234 212', 400: '45 212 191',
      500: '20 184 166', 600: '13 148 136', 700: '15 118 110', 800: '17 94 89', 900: '19 78 74', 950: '4 47 46'
    }
  },
  Rose: {
    primary: { // Tailwind Rose
      50: '255 241 242', 100: '255 228 230', 200: '254 205 211', 300: '253 164 175', 400: '251 113 133',
      500: '244 63 94', 600: '225 29 72', 700: '190 18 60', 800: '159 18 57', 900: '136 19 55', 950: '76 5 25'
    },
    secondary: { // Tailwind Orange
      50: '255 247 237', 100: '255 237 213', 200: '254 215 170', 300: '253 186 116', 400: '251 146 60',
      500: '249 115 22', 600: '234 88 12', 700: '194 65 12', 800: '154 52 18', 900: '124 45 18', 950: '67 20 7'
    }
  },
  Amber: {
    primary: { // Tailwind Amber
      50: '255 251 235', 100: '254 243 199', 200: '253 230 138', 300: '252 211 77', 400: '251 191 36',
      500: '245 158 11', 600: '217 119 6', 700: '180 83 9', 800: '146 64 14', 900: '120 53 15', 950: '69 26 3'
    },
    secondary: { // Tailwind Yellow
      50: '254 252 232', 100: '254 249 195', 200: '254 240 138', 300: '253 224 71', 400: '250 204 21',
      500: '234 179 8', 600: '202 138 4', 700: '161 98 7', 800: '133 77 14', 900: '113 63 18', 950: '66 32 6'
    }
  },
  Cyan: {
    primary: { // Tailwind Cyan
      50: '236 254 255', 100: '207 250 254', 200: '165 243 252', 300: '103 232 249', 400: '34 211 238',
      500: '6 182 212', 600: '8 145 178', 700: '14 116 144', 800: '21 94 117', 900: '22 78 99', 950: '8 51 68'
    },
    secondary: { // Tailwind Sky
      50: '240 249 255', 100: '224 242 254', 200: '186 230 253', 300: '125 211 252', 400: '56 189 248',
      500: '14 165 233', 600: '2 132 199', 700: '3 105 161', 800: '7 89 133', 900: '12 74 110', 950: '8 47 73'
    }
  }
};