# Nebraska Home Hub - Real Estate Marketing Platform

## Overview
Nebraska Home Hub is a comprehensive real estate marketing platform for Omaha-area agents. It provides AI-powered content generation, multi-platform social media management, and SEO analytics to help real estate professionals create engaging marketing content and manage their online presence. The platform uses advanced AI for localized content creation and integrates social media posting, property management, and performance analytics into a unified dashboard. Its business vision is to empower real estate agents with cutting-edge tools to enhance their market reach and engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, and Vite. It uses shadcn/ui components, Radix primitives, and Tailwind CSS for a neutral-themed, accessible design. Wouter handles routing, and TanStack Query manages state and API caching. Real-time updates are facilitated via WebSockets.

### Technical Implementations
The backend uses Express.js with TypeScript (ESM) and Replit's OpenID Connect for authentication with session storage. The API is RESTful, incorporating middleware for user context and authorization. WebSocket support is included for real-time communication. Special attention is paid to iframe and mobile support with environment-aware SameSite and Secure cookie attributes. Secure auto-login within iMakePage is implemented using PostMessage API and URL parameters, with origin validation. A robust OAuth 2.0 system with PKCE (S256) is in place for social media integrations (e.g., Twitter/X, YouTube), featuring database-backed PKCE storage and automatic cleanup.

### Feature Specifications
- **AI Integration**: Leverages OpenAI's GPT-5 for generating real estate marketing content tailored to Omaha neighborhoods.
- **Avatar Support & Gestures**: Supports various avatar types for video generation (public, talking photo, custom photo avatars with gestures). Photo avatar groups undergo a specific training workflow, which includes photo uploads, processing by HeyGen, and user-initiated training. Streaming avatars are also supported.
- **Video Avatar Voice Extraction**: When creating video avatars from training footage, audio is automatically extracted using ffmpeg and uploaded to HeyGen as an audio asset. This extracted voice is stored with the avatar and automatically used when generating videos, allowing avatars to speak in the user's own voice rather than synthetic TTS.
- **Engagement Tracking & Analytics**: A system monitors anonymous user behavior on agent websites, tracking sessions, property interactions (views, likes), and automatically generating leads based on engagement scores. A client-side JavaScript library (`engagement-tracker.ts`) handles real-time tracking and scoring.
- **Video Studio**: A unified 3-step video creation flow (Upload → Ask → Get It) consolidates HeyGen services, allowing users to create talking photo avatars, generate scripts via AI, and produce videos.
- **QR Code Mobile Upload**: Enables users to upload training and consent videos from their mobile devices by scanning a QR code, simplifying the video avatar creation process.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM ensures type-safe operations. The schema supports main users (agents) and public users (clients) with multi-tenancy. Key tables include users, properties, AI content, social posts, and activity tracking.
- **Storage Architecture**: A dual-storage strategy is implemented, combining HeyGen's API storage with AWS S3 for backup and long-term archival of voice recordings, avatar images, and generated videos, ensuring data durability and redundancy.
- **Real-time Communication**: WebSockets provide live updates for content generation status, social media posting, lead notifications, and activity feeds.

## External Dependencies

- **Database**: PostgreSQL (Neon serverless hosting)
- **AI Services**: OpenAI GPT-5 API
- **Authentication**: Replit OpenID Connect
- **Social Media APIs**:
    - Twitter/X OAuth 2.0 (with PKCE)
    - YouTube OAuth
    - Placeholder integrations for Facebook, Instagram, LinkedIn, TikTok
- **UI Components**: Radix UI, Tailwind CSS
- **Real-time Features**: Native WebSocket
- **SEO Tools**: Google PageSpeed Insights API
- **Development Tools**: Vite, TypeScript, Drizzle Kit
- **Video Generation**: HeyGen API (for avatars and video creation)
- **File Storage**: AWS S3