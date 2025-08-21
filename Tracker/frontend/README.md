# Sales Tax Tracker - Frontend

Modern React TypeScript frontend for the Sales Tax Tracker application, built with Vite and Tailwind CSS.

## 🚀 Tech Stack

- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Auth0** - Authentication and authorization
- **Axios** - HTTP client for API calls
- **Lucide React** - Beautiful icons

## 📁 Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── assets/         # CSS and other assets
│   ├── components/     # Reusable React components
│   ├── pages/          # Page components
│   ├── services/       # API and auth services
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── index.html          # HTML template
├── package.json        # Dependencies and scripts
├── tailwind.config.js  # Tailwind configuration
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

## 🛠️ Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   
   Frontend will run on http://localhost:3001

## 🏗️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Auth0 Configuration
VITE_AUTH0_DOMAIN=your-auth0-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=https://sales-tax-tracker-api

# API Configuration
VITE_API_BASE_URL=http://localhost:3002/api
```

### Tailwind CSS

The project uses Tailwind CSS with custom brand colors. The configuration includes:

- Custom color palette (`brand-blue`)
- Forms plugin for better form styling
- Typography plugin for rich text content

### TypeScript

Strict TypeScript configuration with:

- Path mapping for clean imports (`@/components`, `@/services`, etc.)
- Type checking for all files
- Strict mode enabled

## 🎨 UI Components

### Layout Component

Responsive layout with navigation that adapts based on authentication state:

- Desktop and mobile navigation
- User profile display
- Authentication-aware menu items

### Pages

- **Landing Page** - Marketing homepage with features and pricing
- **Demo Insights** - Interactive demo of business insights
- **Dashboard** - Main application dashboard (placeholder)
- **Auth Callback** - Handles Auth0 authentication redirects

### Styling

The project uses a combination of:

- Tailwind utility classes
- Custom CSS components for buttons and interactive elements
- Responsive design patterns

## 🔐 Authentication

Authentication is handled by Auth0 with:

- SPA (Single Page Application) flow
- Token-based API authentication
- Automatic token refresh
- Protected routes

## 📡 API Integration

API calls are centralized in the `services/api.ts` file:

- Axios-based HTTP client
- Automatic token injection
- Error handling and retries
- Typed API responses

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

### Integration with Backend

In development, the frontend runs on port 3001 and proxies API calls to the backend on port 3002.

In production, the backend serves the built frontend files from the `dist/` directory.

## 🔄 Development Workflow

1. **Frontend Development** (port 3001)
   ```bash
   cd frontend
   npm run dev
   ```

2. **Full Stack Development** (from root)
   ```bash
   npm run dev  # Starts both frontend and backend concurrently
   ```

3. **Type Checking**
   ```bash
   npm run type-check
   ```

4. **Linting**
   ```bash
   npm run lint
   ```

## 📚 Key Features

- **Responsive Design** - Works on desktop, tablet, and mobile
- **Type Safety** - Full TypeScript coverage
- **Modern React** - Uses React 19 features
- **Fast Development** - Vite HMR for instant updates
- **Production Ready** - Optimized builds with code splitting
- **Authentication** - Secure Auth0 integration
- **API Ready** - Structured API integration layer

## 🤝 Contributing

1. Follow the existing code style
2. Run type checking before commits
3. Test on multiple screen sizes
4. Ensure all lint rules pass

## 📄 License

MIT License - see the LICENSE file for details.
