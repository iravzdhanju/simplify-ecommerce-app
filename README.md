# Product Sync Platform 🚀

A comprehensive e-commerce product synchronization platform that enables seamless integration between multiple platforms (Shopify, Amazon) with a centralized dashboard for product management.

![Platform Overview](https://img.shields.io/badge/Platform-Multi--Platform-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## ✨ Features

### 🔄 **Multi-Platform Synchronization**
- **Shopify Integration**: Full OAuth flow with GraphQL API 2025-01
- **Amazon SP-API**: Advanced marketplace integration (planned)
- **Real-time Webhooks**: Instant product updates across platforms
- **Bulk Operations**: Import/export thousands of products efficiently

### 🎨 **Modern Dashboard**
- **Live Metrics**: Real-time sync performance and error monitoring
- **Product Management**: Enhanced forms with sync capabilities
- **Connection Health**: Platform connection status and testing
- **Sync Logs**: Complete audit trail of all operations

### 🔐 **Enterprise Security**
- **Hybrid Auth**: Clerk frontend + Supabase backend with RLS
- **OAuth Integration**: Secure platform connections
- **Encrypted Credentials**: Safe storage of API keys and tokens
- **Row-level Security**: Data isolation per user

### ⚡ **Performance Optimized**
- **Cost-based Rate Limiting**: Intelligent Shopify API usage
- **Real-time Updates**: Live dashboard without page refresh
- **Optimistic UI**: Instant feedback for user actions
- **Efficient Caching**: Smart data fetching and storage

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Shopify API   │    │   Amazon SP-API │    │   Future APIs   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ OAuth + Webhooks     │ OAuth + Webhooks     │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Backend                             │
│     PostgreSQL + Edge Functions + Real-time + RLS              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ API Routes
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Next.js Frontend                               │
│    React + TypeScript + TailwindCSS + shadcn/ui                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Clerk Authentication                            │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm (recommended)
- Supabase account
- Clerk account
- Shopify Partner account

### 1. Installation
```bash
git clone <repository-url>
cd simplify-ecommerce-app
pnpm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
```

Configure your `.env.local`:
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Shopify Configuration
SHOPIFY_CLIENT_ID=your-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-shopify-client-secret
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key
```

### 3. Database Setup
Run the SQL schema in your Supabase dashboard (see [Implementation Guide](./docs/IMPLEMENTATION_GUIDE.md#database-setup))

### 4. Start Development
```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) 🎉

## 📖 Documentation

### 📋 **Core Documentation**
- [**🏗️ Architecture Guide**](./docs/ARCHITECTURE.md) - Complete system architecture and design decisions
- [**🛠️ Implementation Guide**](./docs/IMPLEMENTATION_GUIDE.md) - Step-by-step setup and development guide
- [**📚 API Reference**](./docs/API_REFERENCE.md) - Comprehensive API documentation

### 🔧 **Technical Specifications**
- [**📄 Database Schema**](./database/schema.sql) - Complete PostgreSQL schema with RLS
- [**🔌 Shopify Integration**](./shopify.md) - Detailed Shopify API implementation guide
- [**🎯 Project Specifications**](./specs.md) - Original project requirements and scope

## 🛠️ Tech Stack

### **Frontend**
- **[Next.js 15](https://nextjs.org)** - React framework with App Router
- **[TypeScript](https://typescriptlang.org)** - Type-safe development
- **[TailwindCSS](https://tailwindcss.com)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com)** - Modern component library
- **[TanStack Table](https://tanstack.com/table)** - Powerful data tables
- **[React Hook Form](https://react-hook-form.com)** - Performant forms
- **[Zod](https://zod.dev)** - Schema validation

### **Backend**
- **[Supabase](https://supabase.com)** - PostgreSQL database with real-time features
- **[Clerk](https://clerk.com)** - Modern authentication solution
- **Row Level Security** - Database-level authorization
- **Edge Functions** - Serverless compute for webhooks

### **Integrations**
- **[Shopify GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)** - E-commerce platform integration
- **Amazon SP-API** - Marketplace integration (planned)
- **OAuth 2.0** - Secure platform authentication

## 🚢 Deployment

### **Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configure environment variables in Vercel dashboard
```

### **Environment Variables**
Set all production environment variables in your deployment platform:
- Use production Clerk keys
- Use production Supabase project  
- Use production Shopify app credentials
- Generate secure NEXTAUTH_SECRET

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint

# Build verification
pnpm build
```

## 📊 Project Status

### ✅ **Completed Features**
- [x] **Authentication System** - Hybrid Clerk + Supabase with RLS
- [x] **Shopify Integration** - Complete OAuth flow and API integration
- [x] **Product Management** - CRUD operations with sync capabilities
- [x] **Platform Connections** - Connection management with health monitoring
- [x] **Real-time Dashboard** - Live metrics and sync status
- [x] **Enhanced UI** - Modern, responsive interface with loading states
- [x] **Sync Status Tracking** - Visual indicators and audit logs

### 🚧 **In Development**
- [ ] **Bulk Import/Export** - CSV and API-based bulk operations
- [ ] **Advanced Error Handling** - Retry mechanisms and notifications
- [ ] **Sync Logs Dashboard** - Detailed operation monitoring
- [ ] **User Onboarding** - Guided setup flow

### 🔮 **Planned Features**
- [ ] **Amazon SP-API Integration** - Multi-marketplace support
- [ ] **Advanced Analytics** - Performance insights and reporting
- [ ] **Automation Rules** - Conditional sync logic
- [ ] **Team Collaboration** - Multi-user workspace support
- [ ] **Mobile App** - React Native companion app

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### **Development Workflow**
- Follow TypeScript strict mode
- Use conventional commit messages
- Add tests for new features
- Update documentation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### **Getting Help**
- 📖 **Documentation**: Check our comprehensive docs
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- 📧 **Email**: support@your-domain.com

### **Community**
- 🌟 **Star the repo** if you find it useful
- 🐛 **Report bugs** to help us improve
- 💡 **Suggest features** for future development
- 🤝 **Contribute code** to make it better

---

<div align="center">

**Built with ❤️ by the Product Sync Platform Team**

[Documentation](./docs/) • [API Reference](./docs/API_REFERENCE.md) • [Contributing](#contributing) • [License](#license)

</div>