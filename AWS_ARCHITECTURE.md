# 🏗️ Vestia AWS Architecture Overview

## Complete AWS Infrastructure

## 🌐 API Gateway

**Base URL**: `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com`  
**Region**: `ca-central-1` (Canada Central)

### Endpoints

#### Session Management
- `POST /session/scan` → `vestia-session-scan` Lambda
- `GET /session/{sessionId}` → `vestia-session-get` Lambda

#### Request Lifecycle
- `POST /request` → `vestia-request-post` Lambda
- `PATCH /request/{requestId}` → `vestia-request-update` Lambda
- `PATCH /request/{requestId}/claim` → `vestia-request-claim` Lambda
- `GET /store/{storeId}/request` → `vestia-request-get` Lambda

#### Product Catalog
- `GET /product/{sku}` → `vestia-product-get` Lambda
- `POST /recommend` → `vestia-recommend` Lambda

---

## 🗄️ DynamoDB Tables

### 1. **VestiaSessions** (Event-Sourced Architecture)

**Table Name**: `VestiaSessions`  
**Region**: `ca-central-1`

#### Data Model (Composite Key Pattern)

**Partition Key (PK) Patterns**:
- `SESSION#{sessionId}` - Customer kiosk view
- `STORE#{storeId}` - Staff dashboard view

**Sort Key (SK) Patterns**:
- `SCAN#{timestamp}` - Product scans (ISO timestamp)
- `REQUEST#{requestId}` - Product requests

#### Entity Types

**SCAN Events**:
```json
{
  "PK": "SESSION#session-id",
  "SK": "SCAN#2025-12-28T12:00:00Z",
  "entityType": "SCAN",
  "sessionId": "session-id",
  "sku": "15970",
  "kioskId": "KIOSK-001",
  "source": "kiosk|staff",
  "createdAt": "2025-12-28T12:00:00Z"
}
```

**REQUEST Events**:
```json
{
  "PK": "SESSION#session-id" | "STORE#store-id",
  "SK": "REQUEST#request-id",
  "entityType": "REQUEST",
  "requestId": "REQ-123456",
  "sessionId": "session-id",
  "storeId": "STORE-001",
  "kioskId": "KIOSK-001",
  "sku": "15970",
  "requestType": "size_change|color_change|size_color_change",
  "requestedSize": "XL",
  "requestedColor": "Red",
  "status": "QUEUED|CLAIMED|DELIVERED|CANCELLED",
  "createdAt": "2025-12-28T12:00:00Z",
  "updatedAt": "2025-12-28T12:05:00Z",
  "employeeId": "EMP-001" // (optional, when claimed)
}
```

### 2. **ProductCatalog** (Single Source of Truth)

**Table Name**: `ProductCatalog` (referenced in Lambda code)  
**Region**: `ca-central-1`

**Structure**:
```json
{
  "productId": "15970",
  "name": "Turtle Check Men Shirt",
  "category": "top",
  "articleType": "Shirts",
  "color": "blue",
  "price": 40,
  "gender": "men",
  "season": "Fall",
  "usage": "Casual"
}
```

### 3. **VestiaProducts** (Legacy/Alternative)

**Table Name**: `VestiaProducts`  
**Used for**: Product ingestion from S3  
**Structure**: Uses `PK: PRODUCT#{sku}`, `SK: META`

### 4. **CompatibilityStats** (Recommendation Engine)

**Table Name**: `CompatibilityStats`  
**Used for**: ML recommendation scoring  
**Purpose**: Stores article type and color compatibility statistics

---

## ⚡ Lambda Functions

**Runtime**: Node.js 24.x  
**Region**: `ca-central-1`

### Session Management

#### 1. **vestia-session-scan**
- **Purpose**: Records item scans with kioskId tracking
- **Trigger**: `POST /session/scan`
- **Operations**: 
  - `PutCommand` to `VestiaSessions` table
  - Creates `SCAN` event with timestamp as SK
- **Input**: `{ sessionId, sku, kioskId }`
- **Output**: `{ message: "Item scanned", item }`

#### 2. **vestia-session-get**
- **Purpose**: Retrieves normalized session events
- **Trigger**: `GET /session/{sessionId}`
- **Operations**:
  - `QueryCommand` on `VestiaSessions` table
  - Queries by `PK = SESSION#{sessionId}`
- **Output**: `{ sessionId, items: [...] }`

#### 3. **vestia-session-handler**
- **Status**: Placeholder (not implemented)
- **Current**: Returns "Hello from Lambda!"

### Request Lifecycle

#### 4. **vestia-request-post**
- **Purpose**: Creates customer requests (derives kioskId from session)
- **Trigger**: `POST /request`
- **Operations**:
  - `PutCommand` creates **dual records**:
    - `SESSION#{sessionId}` record (for kiosk)
    - `STORE#{storeId}` record (for staff)
- **Features**:
  - Generates unique `requestId` (REQ-XXXXXX format)
  - Sets initial status to "QUEUED"
- **Input**: `{ sessionId, storeId, sku, requestedSize?, requestedColor? }`
- **Output**: `{ requestId, status: "QUEUED" }`

#### 5. **vestia-request-update**
- **Purpose**: Staff actions (QUEUED → CLAIMED → DELIVERED)
- **Trigger**: `PATCH /request/{requestId}`
- **Operations**:
  - `UpdateCommand` updates **both** store and session records
  - `PutCommand` auto-creates SCAN when status = "DELIVERED"
- **Special Feature**: Auto-scan on delivery
  - When `status === "DELIVERED"`, automatically creates a new `SCAN` event
  - This makes delivered items appear in customer session automatically
- **Input**: `{ requestId, storeId, sessionId, status, employeeId? }`
- **Output**: `{ requestId, status, updatedAt }`

#### 6. **vestia-request-claim**
- **Purpose**: Staff pickup functionality
- **Trigger**: `PATCH /request/{requestId}/claim`
- **Operations**:
  - Validates request is in "QUEUED" status
  - Updates status to "CLAIMED"
  - Records `employeeId` and claim timestamp
- **Input**: `{ requestId, storeId, sessionId, employeeId }`
- **Output**: `{ requestId, status: "CLAIMED" }`

#### 7. **vestia-request-get**
- **Purpose**: Admin dashboard data feed
- **Trigger**: `GET /store/{storeId}/request`
- **Operations**:
  - `QueryCommand` on `VestiaSessions` table
  - Queries by `PK = STORE#{storeId}`
- **Output**: `{ requests: [...] }`

### Intelligence Layer

#### 8. **vestia-recommend**
- **Purpose**: Enhanced ML-style recommendation engine
- **Trigger**: `POST /recommend`
- **Environment Variables**:
  - `PRODUCT_TABLE`: "ProductCatalog"
  - `COMPAT_TABLE`: "CompatibilityStats"
- **Operations**:
  - `GetCommand` retrieves base product
  - `GetCommand` retrieves compatibility scores
  - `ScanCommand` finds candidate products
- **Scoring Algorithm**:
  - Article Type Compatibility
  - Color Compatibility
  - Combined scoring with decimal precision
- **Input**: `{ productId, targetCategory, gender? }`
- **Output**: `[{ productId, name, category, score, ... }]` (top 5)

---

## 📦 S3 Buckets

### 1. **vestia-product-images**
- **Bucket**: `vestia-product-images`
- **Region**: `ca-central-1`
- **Access**: Public Read
- **URL Pattern**: `https://vestia-product-images.s3.ca-central-1.amazonaws.com/{sku}.jpg`
- **Purpose**: Product image storage
- **Examples**:
  - `15970.jpg` → Turtle Check Men Shirt image
  - `4831.jpg` → Track pants image

### 2. **vestia-raw-datasets**
- **Bucket**: `vestia-raw-datasets`
- **Key**: `urstyle/fashion_products.json`
- **Purpose**: Raw product data for ingestion
- **Ingestion**: Python script (`ingest_products.py`) loads into DynamoDB

---

## 🔐 IAM Roles & Permissions

### Lambda Execution Roles

#### **Vestia-session-scan**
- **Permissions**: 
  - `dynamodb:GetItem`
  - `dynamodb:PutItem`
  - `dynamodb:UpdateItem`
  - `dynamodb:Query`
- **Resource**: `arn:aws:dynamodb:ca-central-1:125667709386:table/VestiaSessions`

#### **Vestia-session-handler**
- Similar DynamoDB permissions

---

## 🔄 Data Flow

### Customer Scanning Flow
```
Kiosk → POST /session/scan → vestia-session-scan Lambda
  → DynamoDB PutCommand → VestiaSessions (SCAN event)
  → Frontend polls GET /session/{sessionId}
  → vestia-session-get Lambda → QueryCommand
  → Frontend joins with ProductCatalog
```

### Request Lifecycle Flow
```
Customer → POST /request → vestia-request-post Lambda
  → Creates dual records (SESSION + STORE)
  → Staff sees in admin dashboard
  → Staff clicks "Picked Up" → PATCH /request/{requestId}
  → vestia-request-update Lambda → Updates to CLAIMED
  → Staff clicks "Delivered" → PATCH /request/{requestId}
  → vestia-request-update Lambda → Updates to DELIVERED
  → Auto-creates SCAN event
  → Customer sees item in session (via polling)
```

### Recommendation Flow
```
Customer selects item → POST /recommend
  → vestia-recommend Lambda
  → Queries ProductCatalog + CompatibilityStats
  → Scores candidates
  → Returns top 5 recommendations
  → Frontend displays with images from S3
```

---

## 📊 Architecture Patterns

### 1. **Event Sourcing**
- All events stored as immutable records
- SCAN and REQUEST events have timestamps
- Full audit trail for analytics

### 2. **Dual Record Pattern**
- Requests stored in both `SESSION#{sessionId}` and `STORE#{storeId}`
- Enables efficient queries for both kiosk and staff views
- Updates synchronized across both records

### 3. **Normalized Data Model**
- `VestiaSessions`: Event log (no product duplication)
- `ProductCatalog`: Single source of truth for product metadata
- Frontend joins data in-memory for UI rendering

### 4. **Auto-Scan on Delivery**
- When request status → "DELIVERED"
- Lambda automatically creates SCAN event
- Item appears in customer session without manual scan

---

## 🛠️ Infrastructure Components

### Frontend Integration
- **API Client**: `VestiaAPI` class in `frontend/src/lib/api.ts`
- **Base URL**: `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com`
- **Image URL**: `https://vestia-product-images.s3.ca-central-1.amazonaws.com/{sku}.jpg`

### Data Ingestion
- **Script**: `AWS/S3ToDynamoDB/ingest_products.py`
- **Process**: S3 → DynamoDB (VestiaProducts table)
- **Normalization**: Layer → category, color normalization

---

## 📈 Scalability Features

1. **DynamoDB**: Auto-scaling, pay-per-request
2. **Lambda**: Serverless, scales automatically
3. **API Gateway**: Handles high traffic
4. **S3**: Unlimited storage for product images
5. **Multi-kiosk Support**: kioskId tracking enables store-wide deployment

---

## 🔍 Key Features

✅ **Event-sourced architecture** (audit trail, analytics-ready)  
✅ **Multi-kiosk deployment** (scales to entire store)  
✅ **Staff workflow integration** (seamless request fulfillment)  
✅ **Real-time customer experience** (live delivery updates via polling)  
✅ **Intelligent recommendations** (ML-style scoring algorithm)  
✅ **Performance optimized** (normalized data, efficient queries)  
✅ **Image support** (S3-hosted product images)  
✅ **Gender-aware** (consistent recommendation filtering)

---

## 📝 Summary

**Total AWS Services Used**:
- ✅ API Gateway (REST API)
- ✅ Lambda (8 functions)
- ✅ DynamoDB (4+ tables)
- ✅ S3 (2 buckets)
- ✅ IAM (Lambda execution roles)

**Region**: `ca-central-1` (Canada Central)  
**Account ID**: `125667709386` (from IAM ARN)

---

**Last Updated**: December 2024  
**Status**: Production-ready AWS infrastructure

