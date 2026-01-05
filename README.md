# Vestia - The Retail Experience Platform (RXM)

A smart fitting room system that bridges physical retail with digital experiences. Customers scan items in fitting rooms, request different sizes/colors from staff, and receive personalized recommendations - all through kiosk interfaces.

## 🚀 Quick Start

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The application will be available at:
- **Main Kiosk Interface**: http://localhost:3000
- **Kiosk Session Page**: http://localhost:3000/kiosk/session
- **Staff Dashboard**: http://localhost:3000/admin
- **Analytics Dashboard**: http://localhost:3000/analytics

## 📁 Project Structure

```
Vestia_The-Retail-Experience-Platform_RXM/
├── frontend/          # Next.js frontend application
├── backend/           # Node.js backend (legacy)
├── AWS/               # AWS Lambda functions and infrastructure
│   ├── Lambda/        # Lambda function code
│   ├── IAM/           # IAM role configurations
│   └── S3ToDynamoDB/  # Data ingestion scripts
└── Documents/         # Project documentation
```

## 🏗️ Architecture

### Frontend
- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks

### Backend (AWS)
- **API Gateway**: REST API endpoints
- **Lambda Functions**: Serverless functions (Node.js 24.x)
- **DynamoDB**: Event-sourced session data + Product catalog
- **S3**: Product images storage

See [AWS_ARCHITECTURE.md](./AWS_ARCHITECTURE.md) for complete infrastructure details.

## 🎯 Key Features

- ✅ Item scanning with barcode support
- ✅ Real-time request fulfillment (QUEUED → CLAIMED → DELIVERED)
- ✅ AI-powered product recommendations
- ✅ Multi-kiosk support with kioskId tracking
- ✅ Staff dashboard for request management
- ✅ Analytics dashboard for store insights
- ✅ End session feedback collection
- ✅ Performance optimizations (debouncing, request deduplication)

## 📝 Available Pages

### Customer-Facing
- `/` - Welcome screen / Main kiosk interface
- `/kiosk/session` - Active fitting room session

### Staff-Facing
- `/admin` - Staff dashboard for managing customer requests
- `/analytics` - Analytics dashboard for store metrics

## 🔧 Development

### Frontend
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
```

### Environment Variables
The frontend connects to AWS API Gateway:
- **API Base URL**: `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com`
- **Image Base URL**: `https://vestia-product-images.s3.ca-central-1.amazonaws.com/`

## 📚 Documentation

- [AWS Architecture](./AWS_ARCHITECTURE.md) - Complete AWS infrastructure overview
- [Frontend Improvements](./frontend/FRONTEND_IMPROVEMENTS.md) - Frontend enhancements
- [Performance Fixes](./frontend/PERFORMANCE_FIXES.md) - Performance optimization details

## 🛠️ Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: AWS Lambda, API Gateway, DynamoDB, S3
- **Region**: ca-central-1 (Canada Central)

## 📄 License

This project is part of a capstone project for COMPSCI 4ZP6A/B.
