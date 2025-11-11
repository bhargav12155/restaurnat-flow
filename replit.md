# Nebraska Home Hub - Real Estate Marketing Platform

## Overview

Nebraska Home Hub is a comprehensive real estate marketing platform designed specifically for Omaha-area agents. The application leverages AI-powered content generation, multi-platform social media management, and SEO analytics to help real estate professionals create engaging marketing content and manage their online presence effectively.

The platform uses GPT-5 for intelligent content creation tailored to local Omaha neighborhoods like Benson, Dundee, and Midtown, while providing integrated social media posting, property management, and performance analytics in a unified dashboard experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client application is built with React and TypeScript, using Vite as the build tool. The UI leverages shadcn/ui components built on Radix primitives, styled with Tailwind CSS using a neutral color scheme. The application uses Wouter for routing and TanStack Query for state management and API caching. Real-time updates are handled through WebSocket connections for live notifications and data synchronization.

### Backend Architecture
The server runs on Express.js with TypeScript in ESM mode. Authentication is handled through Replit's OpenID Connect integration with session storage. The API follows RESTful conventions with middleware for user context extraction and authorization. WebSocket support enables real-time communication for live updates and notifications.

### Database Design
The application uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema supports both main users (real estate agents) and public users (clients) with multi-tenancy through agent slugs. Key tables include users, properties, AI-generated content, social posts, SEO keywords, user activity tracking, and file uploads. Session storage is implemented for authentication persistence.

### AI Integration
Content generation is powered by OpenAI's GPT-5 model, specifically optimized for real estate marketing in the Omaha market. The AI service generates tailored content for social posts, blog articles, property descriptions, and email campaigns with local market knowledge and neighborhood-specific insights.

### Storage Architecture
The application implements a dual-storage strategy combining HeyGen's API storage with AWS S3 for backup and long-term archival:

**Voice Recordings**: Audio files are simultaneously stored in both S3 (permanent backup) and HeyGen (for voice cloning). The S3 URL provides playback capability while the HeyGen audio asset ID enables video generation with custom voices.

**Avatar Images**: Photos uploaded for avatar creation are backed up to S3 and sent to HeyGen's storage. S3 provides long-term archival while HeyGen uses the images to create photo avatar groups with multiple poses.

**Generated Videos**: Videos produced by HeyGen are automatically downloaded and backed up to S3 when generation completes. The system stores both the HeyGen CDN URL (for immediate playback) and the S3 URL (for permanent archival and redundancy). Thumbnails are also backed up to S3.

This dual-storage approach ensures data durability, reduces dependency on HeyGen's CDN availability, and provides cost-effective long-term storage for user-generated content.

### Real-time Communication
WebSocket connections provide live updates for content generation status, social media posting results, new lead notifications, and system-wide activity feeds. The frontend maintains connection state and handles reconnection logic automatically.

### Engagement Tracking & Analytics
The platform includes a comprehensive engagement tracking system that monitors anonymous user behavior on agent websites to identify high-quality leads automatically:

**Session Tracking**: Captures user browsing sessions with device fingerprinting, page views, time spent, and navigation patterns. Sessions persist across page loads using sessionStorage and automatically track metrics like total page views, properties viewed, and properties liked.

**Property Interaction Analytics**: Records detailed user interactions including property views, time spent on listings, likes/favorites, and engagement patterns. Each interaction is timestamped and associated with the user's session for comprehensive behavior analysis.

**Automatic Lead Generation**: Implements an engagement scoring algorithm that automatically generates leads when users meet specific thresholds:
- Score ≥25 triggers lead creation
- Scoring factors: session duration (300s+ = 20pts, 600s+ = 35pts), multiple property views (3+ = 15pts), property likes (10pts each), high interaction count (5+ = 10pts)
- Lead quality classification: hot (score ≥40), warm (25-39), cold (<25)

**Client-Side Tracking Library**: JavaScript library (`engagement-tracker.ts`) provides session initialization, heartbeat monitoring (30-second intervals with delta time tracking), property view tracking, like/unlike tracking, and real-time engagement scoring. Uses incremental time deltas to prevent double-counting and ensure accurate session duration metrics.

**Analytics Endpoints**: RESTful API provides engagement overview (sessions, views, likes, leads), recent leads list, property engagement stats (top viewed, like counts), and session details for agent-specific analytics dashboards.

## External Dependencies

**Database**: PostgreSQL with Neon serverless hosting for scalable database operations

**AI Services**: OpenAI GPT-5 API for intelligent content generation with real estate market specialization

**Authentication**: Replit OpenID Connect for secure user authentication and session management

**Social Media APIs**: Integration endpoints for Facebook, Instagram, Twitter, and YouTube for multi-platform content distribution

**UI Components**: Radix UI primitives for accessible component foundation, styled with Tailwind CSS

**Real-time Features**: Native WebSocket implementation for live updates and notifications

**SEO Tools**: Google PageSpeed Insights API integration for performance monitoring and SEO analysis

**Development Tools**: Vite for development server and build process, TypeScript for type safety, Drizzle Kit for database migrations