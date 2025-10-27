# Napoleon Shopify Smart Pricing App

A modern, feature-rich pricing management application for Shopify stores built with Next.js 15 and TypeScript.

## 🚀 Features

### 📦 Product Management
- **Grid & List Views**: Switch between immersive grid cards and detailed table views
- **Advanced Filtering**: Search by title, vendor, tags, and product type
- **Smart Sorting**: Sort by title, price, update date, or sales volume
- **Real-time Search**: Instant results with relevance scoring

### 💰 Smart Bulk Pricing
- **Site-wide Updates**: Apply pricing changes to all products at once
- **Selective Updates**: Target specific products using checkboxes
- **Percentage & Fixed Changes**: Increase/decrease by percentage or fixed amounts
- **Confirmation Dialogs**: Safety prompts for bulk changes affecting all products
- **Undo Functionality**: One-click revert for any bulk changes
- **Toast Notifications**: Real-time feedback with inline undo actions

### 🎯 Variant Management
- **Immersive Overlay**: Full-screen variant editor with better readability
- **Navigation Arrows**: Quick navigation between products with variants
- **Keyboard Shortcuts**: Use ← → arrows to navigate, Escape to close
- **Variant Counter**: Shows "Product X of Y with variants"
- **Inventory Tracking**: Visual stock indicators with color coding

### 🏗️ Architecture
- **Feature-Based Structure**: Organized by business domains, not technical layers
- **Type-Safe**: Full TypeScript implementation
- **Component Library**: Built with shadcn/ui components
- **Responsive Design**: Works seamlessly on desktop and mobile

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Notifications**: Sonner (Toast)
- **State Management**: React hooks with local state

## 📁 Project Structure

```
src/
├── features/           # Business features
│   ├── product-management/
│   │   ├── components/ # Product-specific components
│   │   ├── hooks/      # Product-related hooks
│   │   ├── services/   # Product services
│   │   ├── types/      # Product types
│   │   └── utils/      # Product utilities
│   ├── analytics-dashboard/
│   ├── auth/
│   ├── pricing-engine/
│   └── shopify-integration/
├── shared/             # Global components & utilities
│   ├── components/ui/  # Reusable UI components
│   ├── hooks/          # Global hooks
│   ├── lib/            # Utilities
│   └── types/          # Global types
└── app/                # Next.js app directory
    ├── (app)/          # Authenticated routes
    └── globals.css     # Global styles
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/marcosbb310/napoleonshopify3.git
   cd napoleonshopify3
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Usage

### Bulk Pricing Changes

1. **Site-wide Update**:
   - Click "Bulk Edit Pricing" (no products selected)
   - Configure your changes (e.g., Base Price +10%)
   - Confirm the warning dialog
   - Apply changes to all products

2. **Selective Update**:
   - Select specific products using checkboxes
   - Click "Bulk Edit Pricing (X)"
   - Configure and apply changes immediately

3. **Undo Changes**:
   - Use the "Undo Last Change" button in the header
   - Or click "Undo" in the toast notification

### Variant Navigation

1. **Open Variants**: Click "X variants" on any product card
2. **Navigate**: Use arrow buttons or keyboard arrows (← →)
3. **Close**: Press Escape or click the X button

### Product Management

1. **Search**: Use the search bar for instant results
2. **Filter**: Apply filters by tags, price range, margin, etc.
3. **Sort**: Change sorting criteria and direction
4. **View**: Switch between Grid and List views

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file in the root directory:

```env
# Shopify Configuration (when implementing real integration)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
```

### Customization
- **Themes**: Modify colors in `tailwind.config.js`
- **Components**: Customize shadcn/ui components in `src/shared/components/ui/`
- **Features**: Add new features following the feature-based architecture

## 📊 Mock Data

The app currently uses mock data for demonstration. To integrate with real Shopify data:

1. Update `src/features/product-management/hooks/useProducts.ts`
2. Implement Shopify API calls in `src/features/shopify-integration/services/`
3. Replace mock data with actual API responses

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Lucide](https://lucide.dev/) - Beautiful icons

## 📞 Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Check the documentation
- Review the code examples

---

**Built with ❤️ for Shopify merchants**