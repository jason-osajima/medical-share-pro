# Medical Document Management System

A secure, mobile-responsive document management system designed for healthcare information tracking. This application helps caregivers organize, process, and share medical documents while maintaining security and accessibility.

## Features

### Document Management
- **Smart Document Upload**: Upload medical documents with automatic text extraction using OCR
- **AI-Powered Summaries**: Automatic document summarization using GPT-3.5
- **Advanced Search**: Search through documents using multiple filters:
  - Full-text search
  - Category-based filtering
  - Tag-based organization
  - Date range filtering

### Security & Access Control
- **Secure Authentication**: Two-factor authentication (2FA) support
- **Secure Document Sharing**: Generate temporary access links with:
  - Expiration dates
  - Access count limits
  - Automatic link deactivation

### User Experience
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Document Preview**: Built-in document viewer with OCR text display
- **Timeline View**: Chronological organization of medical records
- **Tag Management**: Flexible document categorization

## Tech Stack

- **Frontend**:
  - React with TypeScript
  - TanStack Query for data fetching
  - Tailwind CSS & shadcn/ui for styling
  - Tesseract.js for OCR processing

- **Backend**:
  - Node.js with Express
  - PostgreSQL database with Drizzle ORM
  - OpenAI GPT-3.5 for document summarization
  - Passport.js for authentication

## Setup

1. **Environment Variables**
   Required environment variables:
   ```
   DATABASE_URL=postgresql://...
   SESSION_SECRET=your-session-secret
   OPENAI_API_KEY=your-openai-api-key
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   ```bash
   npm run db:push
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Usage

### Document Upload
1. Navigate to the home page
2. Click "Upload Document"
3. Select a document (PDF or image)
4. Add metadata (name, category, tags)
5. Submit to process and store the document

### Document Search
1. Use the search bar for text search
2. Apply filters:
   - Categories
   - Tags
   - Date range
3. Results update in real-time

### Document Sharing
1. Open a document
2. Click "Share"
3. Configure share settings:
   - Expiration time
   - Maximum access count
4. Copy and share the generated link

### Two-Factor Authentication
1. Navigate to account settings
2. Enable 2FA
3. Scan QR code with authenticator app
4. Enter verification code to complete setup

## Security Considerations

- All documents are stored securely with access control
- Session management with secure cookie handling
- Rate limiting on API endpoints
- Input validation and sanitization
- Automatic document access logging
- Secure document sharing with expiring links

## License

This project is private and confidential. All rights reserved.
