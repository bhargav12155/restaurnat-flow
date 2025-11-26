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

**Iframe & Mobile Support**: Authentication cookies use environment-aware SameSite and Secure attributes to support both iframe embedding and mobile access:
- **Development Mode**: Uses `SameSite=Lax` with conditional `Secure` flag for HTTP compatibility
- **Production Mode**: Uses `SameSite=None; Secure` for cross-site iframe embedding and mobile browser support
- **Cookie Settings**: Applied across all 5 auth endpoints (agent register/login, public login, universal login paths)
- **CORS Configuration**: Credentials enabled for NebraskaHomeHub domains to support cross-origin requests

**iMakePage Integration**: Secure auto-login when embedded in iMakePage using standard cross-origin communication:
- **PostMessage API**: Primary method for secure parent-iframe communication with origin validation
- **URL Parameters**: Alternative method using `?autoLogin=true&userEmail=X&source=imakepage`
- **Origin Whitelist**: Only accepts messages from https://www.imakepage.com and https://imakepage.com
- **Automatic Fallback**: Gracefully falls back to manual login if integration unavailable
- **No Backend Proxy**: All communication happens client-side to prevent cookie leakage

**Social Media OAuth System**: Implements secure OAuth 2.0 flows for third-party platform integrations:
- **PKCE Implementation**: Uses SHA-256 code challenge/verifier pairs with 10-minute expiration for enhanced security (required for Twitter/X OAuth 2.0)
- **PKCE Storage**: Database-backed storage using `pkce_store` table ensures PKCE codes persist across server instances and deployments, preventing OAuth callback failures
- **State Management**: Automatic cleanup of expired PKCE entries every 10 minutes via scheduled database cleanup
- **User Reconciliation**: Automatically creates users in MemStorage from OIDC tokens during OAuth flows
- **Token Storage**: Securely stores access tokens and refresh tokens in social media account records
- **Callback Handling**: Platform-specific callback handlers with comprehensive error handling and user-friendly success pages
- **Multi-Platform Support**: Extensible architecture supporting Twitter/X, YouTube, LinkedIn with consistent patterns
- **Platform Normalization**: Frontend normalizes platform aliases (twitter→x, facebook_page→facebook) and provides fallback icons (Settings) for unknown platforms to ensure all connected accounts are visible
- **Production Configuration**: Requires `BASE_URL` environment variable set to production URL (e.g., `https://multi-users-realtyflow.replit.app`) for proper OAuth redirect handling

### Database Design
The application uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema supports both main users (real estate agents) and public users (clients) with multi-tenancy through agent slugs. Key tables include users, properties, AI-generated content, social posts, SEO keywords, user activity tracking, and file uploads. Session storage is implemented for authentication persistence.

**Critical Schema Fixes (November 2025):**
- **Custom Voices Table**: Added required columns (`audio_url`, `file_size`, `heygen_audio_asset_id`, `status`) and made `heygen_voice_id`/`language` optional to match actual upload workflow requirements
- **Photo Avatar Groups Table**: Corrected field mappings (`groupName` instead of `name`, `trainingStatus` instead of `status`) to align with database schema
- **Content Opportunities**: Fixed column references to use existing schema (`priority`, `createdAt` instead of non-existent `searchSignal`, `generatedAt`)
- **Schema Synchronization**: All database operations now correctly use Drizzle-typed fields matching the PostgreSQL schema, eliminating production SQL errors

### AI Integration
Content generation is powered by OpenAI's GPT-5 model, specifically optimized for real estate marketing in the Omaha market. The AI service generates tailored content for social posts, blog articles, property descriptions, and email campaigns with local market knowledge and neighborhood-specific insights.

### Avatar Support & Gestures
**Video Generation**: Supports three avatar types:
- Public Avatars: HeyGen's professional avatars with lip-sync only
- Talking Photo: Upload a single photo for AI-generated talking head videos
- Custom Photo Avatars: Multi-pose photo avatar groups with full gesture support (hand movements, body animation)

**Streaming Avatars**: Only supports dedicated streaming avatars:
- Public HeyGen streaming avatars (Wayne, Angela, Josh, Anna, Tyler)
- Custom streaming avatars imported via HeyGen API (must have valid `heygenAvatarId`)
- **Photo avatar groups NOT supported** for streaming (only for video generation)

**Gesture Controls**: Available for avatars with `supportsGestures=true`. Intensity levels: Off, Subtle, Moderate, Expressive (0-3 scale). Gesture controls dynamically show/hide based on selected avatar's capabilities.

**Photo Avatar Training Workflow** (Fixed November 19, 2025):
- Upload photos → HeyGen status = "pending" (processing images) → UI shows "Processing Images..." with spinner
- HeyGen finishes → status = "completed" → Photos appear in gallery
- **Upload more photos** → Training requires 2+ diverse photos (different angles, expressions, outfits)
- When 2+ photos ready → UI shows "Train Avatar" button
- User clicks Train → trains avatar group → status = "ready" → UI shows "New Looks" and "Edit" buttons
- Backend automatically syncs HeyGen status from API responses to database when fetching groups
- Removed automatic training attempt immediately after group creation (was failing because HeyGen needs time to process images first)
- Fixed "Model not found" errors by enforcing proper training sequence and minimum photo requirements (2+ photos needed)

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

**Social Media APIs**: 
- **Twitter/X OAuth 2.0**: Full OAuth implementation with PKCE (S256) security for secure token exchange. Supports tweet posting with media uploads, automatic token refresh, and account connection management.
- **YouTube OAuth**: Video upload integration with OAuth token management
- Integration endpoints for Facebook, Instagram, LinkedIn, and TikTok (placeholder support)
- **Unified Post Composer**: Comprehensive posting interface with media attachment, multi-platform publishing, and character limit validation. Supports attaching AI-generated avatars and videos to posts with platform-specific previews and validation

**UI Components**: Radix UI primitives for accessible component foundation, styled with Tailwind CSS

**Real-time Features**: Native WebSocket implementation for live updates and notifications

**SEO Tools**: Google PageSpeed Insights API integration for performance monitoring and SEO analysis

**Development Tools**: Vite for development server and build process, TypeScript for type safety, Drizzle Kit for database migrations

### Video Studio (Unified Video Generation)
**Added November 2025**: Simplified 3-step video creation flow that consolidates multiple fragmented HeyGen services into a single, easy-to-use interface.

**Architecture**:
- `server/services/video-studio.ts`: Unified service consolidating HeyGen video generation capabilities
- `client/src/components/dashboard/video-studio.tsx`: 3-step UI component following "Upload → Ask → Get It" pattern
- New API endpoints: `/api/studio/avatars`, `/api/studio/script`, `/api/studio/generate`, `/api/studio/status`

**3-Step Flow**:
1. **Upload**: Upload a photo to create a custom talking photo avatar, or select from existing avatars (tabbed interface)
2. **Ask**: Enter a topic and AI generates a professional marketing script, with editing capability
3. **Get It**: Generate the video with progress tracking and download when complete

**Technical Details**:
- File uploads use multer with disk storage; files read via `fs.readFileSync` and cleaned up in `finally` blocks
- Avatar creation delegates to HeyGen's talking photo API
- Script generation uses OpenAI GPT
- Video generation supports both preset avatars and photo avatars with configurable aspect ratios
- Status polling every 5 seconds until video completion