# Shopify Smart Pricing App - Project Overview

## 🎯 Project Description

A smart pricing application for Shopify stores that maximizes profit by dynamically adjusting product prices based on various factors including demand, time of day, day of week, and holidays.

## 🏗️ Architecture

This project follows a **feature-based architecture** as defined in `.cursorrules`, organizing code by business features rather than technical categories.

### Folder Structure

```
src/
├── features/           # Business features (self-contained)
│   ├── auth/          # Authentication & user management
│   ├── shopify-integration/  # Shopify API integration
│   ├── product-management/   # Product catalog management
│   ├── pricing-engine/       # Pricing logic & algorithms
│   └── analytics-dashboard/  # Metrics & insights
├── shared/            # Global shared code
│   ├── components/   # UI components (shadcn/ui)
│   ├── hooks/        # Global hooks
│   ├── lib/          # Utilities
│   └── types/        # Global types
└── app/              # Next.js pages & layouts
    ├── (app)/        # Authenticated routes
    │   ├── dashboard/
    │   ├── products/
    │   ├── analytics/
    │   └── settings/
    └── page.tsx      # Login page
```

## 🎨 Design System

### Colors (Shopify Theme)
- **Primary (Green)**: `hsl(175, 90%, 45%)` - #00848E
- **Secondary (Lime)**: `hsl(72, 51%, 55%)` - #96BF48
- **Accent (Blue)**: `hsl(210, 90%, 55%)` - #5C6AC4

### Tech Stack
- **Framework**: Next.js 15 with App Router & Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **State Management**: Zustand (for auth)
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## 📱 Features Implemented

### ✅ Authentication
- Login form with validation
- Session management with Zustand
- Protected routes
- User profile storage
- Location: `src/features/auth/`

### ✅ Shopify Integration (Framework)
- API client class with error handling
- Product fetching methods
- Price update methods (single & bulk)
- TypeScript types for Shopify data
- Location: `src/features/shopify-integration/`

### ✅ Product Management
- **Grid & List View**: Toggle between card and table layouts
- **Search & Filters**: Real-time product filtering
- **Sorting**: By name, price, date, sales
- **Bulk Selection**: Select multiple products
- **Bulk Editing**: Update pricing for multiple products by percentage or fixed amount
- **Mock Data**: Sample products for development
- Location: `src/features/product-management/`

### ✅ Dashboard
- Key metrics cards (Revenue, Profit, Products, Price Changes)
- Recent activity feed
- Quick actions
- Location: `src/app/(app)/dashboard/`

### ✅ Analytics (Framework)
- Tabbed interface (Overview, Pricing History, Product Performance)
- Placeholder for charts (ready for data integration)
- Top performing products list
- Recent price changes
- Location: `src/app/(app)/analytics/`

### ✅ Settings
- Shopify credentials input (Store URL, API Token)
- Account settings
- Global pricing parameters
- Location: `src/app/(app)/settings/`

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Navigate to project
cd /Users/marcosbb310/Desktop/code/napoleonshopify3/napoleonshopify3

# Install dependencies (already done)
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Development URL
```
http://localhost:3000
```

### Default Login
Currently using mock authentication - any email/password will work for testing.

## 📝 Next Steps

### Immediate Tasks
1. **Connect Real Shopify API**
   - Add your Shopify store credentials in Settings
   - Replace mock data in `useProducts` hook
   - Test product fetching and price updates

2. **Build Pricing Algorithm**
   - Implement time-based pricing rules
   - Add demand-based adjustments
   - Create holiday pricing schedules
   - Location: `src/features/pricing-engine/`

3. **Add Charts & Analytics**
   - Integrate Recharts for visualizations
   - Add pricing history tracking
   - Implement profit/revenue trends
   - Location: `src/features/analytics-dashboard/`

4. **Individual Product Editing**
   - Create product detail dialog/page
   - Add inline editing capabilities
   - Implement pricing parameter controls

5. **Real-time Price Updates**
   - Set up webhooks for instant sync
   - Add background jobs for scheduled updates
   - Implement rollback/undo functionality

### Future Enhancements
- Advanced filtering (by tags, vendor, type)
- Price change history per product
- A/B testing for pricing strategies
- Profit margin optimization
- Inventory-based pricing
- Email notifications for price changes
- Multi-user support with roles
- Dark mode toggle

## 🔧 Configuration

### Shopify API Setup
1. Go to Shopify Admin → Apps → Develop apps
2. Create new app with Admin API access
3. Get Access Token
4. Add credentials in Settings page

### Environment Variables (Optional)
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "next": "15.5.4",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "@radix-ui/react-*": "Latest",
    "zustand": "Latest",
    "react-hook-form": "^7.63.0",
    "zod": "^4.1.11",
    "recharts": "^2.15.4",
    "lucide-react": "^0.544.0"
  }
}
```

## 🎯 Code Quality

- ✅ All linting errors fixed
- ✅ TypeScript strict mode enabled
- ✅ Consistent code formatting
- ✅ Feature-based organization
- ✅ Clean import hierarchy
- ✅ Proper error handling

## 📚 Documentation

- **Architecture Rules**: See `.cursorrules`
- **Component API**: Each feature exports through `index.ts`
- **Type Definitions**: Located in `types/index.ts` per feature

## 🤝 Development Guidelines

1. **Always follow feature-based architecture**
2. **Never create files in prohibited folders** (see `.cursorrules`)
3. **Export public APIs through index.ts**
4. **Keep shared/ minimal** (only code used by 3+ features)
5. **Use TypeScript strictly**
6. **Follow Shopify design patterns**

## 📊 Build Status

✅ **Build**: Successful  
✅ **Lint**: No errors  
✅ **Type Check**: Passing  
✅ **Architecture**: Compliant with .cursorrules

---

**Built with ❤️ for Shopify merchants**
