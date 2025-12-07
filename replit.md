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
- **AI Content Generator Wizard**: A step-by-step wizard UI for content creation with 4 steps: (1) Choose Content Type - visual card selection for social posts, blog articles, property features, market updates; (2) Add Details - topic input or property search based on content type; (3) Generate - summary review and AI generation; (4) Share - results with platform-specific sharing. The wizard maintains state when navigating back/forward and provides clear progress indication.
- **AI Integration**: Leverages OpenAI's GPT-5 for generating real estate marketing content tailored to Omaha neighborhoods.
- **Avatar Support & Gestures**: Supports various avatar types for video generation (public, talking photo, custom photo avatars with gestures). Photo avatar groups undergo a specific training workflow, which includes photo uploads, processing by HeyGen, and user-initiated training. Streaming avatars are also supported.
- **Video Avatar Voice Extraction**: When creating video avatars from training footage, audio is automatically extracted using ffmpeg and uploaded to HeyGen as an audio asset. This extracted voice is stored with the avatar and automatically used when generating videos, allowing avatars to speak in the user's own voice rather than synthetic TTS.
- **Engagement Tracking & Analytics**: A system monitors anonymous user behavior on agent websites, tracking sessions, property interactions (views, likes), and automatically generating leads based on engagement scores. A client-side JavaScript library (`engagement-tracker.ts`) handles real-time tracking and scoring.
- **Video Studio**: A unified 3-step video creation flow (Upload → Ask → Get It) consolidates HeyGen services, allowing users to create talking photo avatars, generate scripts via AI, and produce videos.
- **QR Code Mobile Upload**: Enables users to upload training and consent videos from their mobile devices by scanning a QR code, simplifying the video avatar creation process.
- **Event Calendar**: Tracks local events from multiple calendar sources (iCal feeds, Google Calendar) and generates AI-powered social media posts timed to each event. Features include: event source management with sync capability, manual event creation with all-day toggle and category selection, AI post generation for multiple platforms (Facebook, Instagram, LinkedIn, X), and post scheduling suggestions (T-24h and T-2h before events). Located at `/events` route with form validation using Zod/react-hook-form.
- **User-Configurable AI Engine Preferences**: Allows users to select their preferred AI provider (OpenAI, Anthropic/Claude, Google/Gemini, or Platform Default) in Brand Settings. Users can optionally provide their own API keys for BYOK (Bring Your Own Key) model. API keys are encrypted server-side using AES-256-GCM encryption before storage. The encrypted keys never leave the server - only boolean status and masked last 4 characters are returned to the frontend. Located in Brand Settings → Visual Identity (Step 2). Endpoints: GET/PUT /api/ai-preferences, DELETE /api/ai-preferences/api-key.
- **Kling AI Motion Video Generation**: Enables users to transform static avatar images into dynamic motion videos using Kling AI's image-to-video API. Features include: HeyGen-style motion templates (Talking Naturally, Expert Presentation, Dynamic Announcement, Keynote Speaker, Thoughtful Conversation, Telling a Funny Story) with tab-based UI for templates vs custom prompts, configurable video duration (5 or 10 seconds), real-time progress tracking with polling, and video preview/download. Authentication uses JWT tokens generated from Access Key + Secret Key (stored as KLING_ACCESS_KEY and KLING_SECRET_KEY environment secrets). Located in Avatar Studio with "Add Motion" button on avatar look popup. Endpoints: POST /api/kling/generate-motion, GET /api/kling/status/:taskId. Service: server/services/kling.ts.
- **Dual Voice Provider System**: Supports both ElevenLabs and Kling for voice generation, with a toggle in the motion dialog to select provider. ElevenLabs provides high-quality voice synthesis using the Rachel voice (voice_id: 21m00Tcm4TlvDq8ikWAM) with mp3_44100_128 output format. Kling provides built-in text-to-video with lip-sync. Requires ELEVENLABS_API_KEY secret for ElevenLabs provider. Service: server/services/elevenlabs.ts.
- **Hover-to-Play Motion Preview**: Avatar looks with motion (is_motion: true) display a purple "Motion" badge and auto-play their motion video on hover in the avatar grid. The popup dialog also shows the motion video for motion-enabled avatars. Provides a HeyGen-style interactive preview experience. State tracked via hoveredLookId in AvatarStudio component.
- **Save Motion Button**: Allows users to download motion videos before attempting voice generation, preventing work loss if voice API calls fail.

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