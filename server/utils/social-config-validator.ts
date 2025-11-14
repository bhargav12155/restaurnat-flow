/**
 * Social Media Configuration Validator & Auto-Fixer
 * 
 * Automatically validates and helps fix social media OAuth configurations
 * to prevent manual setup errors and ensure all platforms are properly configured.
 */

interface ConfigCheck {
  platform: string;
  status: 'valid' | 'warning' | 'error';
  message: string;
  autoFixAvailable?: boolean;
  fixInstructions?: string;
}

interface SocialMediaConfig {
  platform: string;
  clientId?: string;
  clientSecret?: string;
  requiredScopes: string[];
  callbackPaths: string[];
  apiEndpoints: string[];
}

export class SocialConfigValidator {
  private baseUrl: string;
  
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:5000';
  }

  /**
   * Get platform configuration requirements
   */
  private getPlatformConfig(platform: string): SocialMediaConfig | null {
    const configs: Record<string, SocialMediaConfig> = {
      twitter: {
        platform: 'Twitter/X',
        clientId: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
        requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        callbackPaths: ['/api/social/callback/twitter', '/api/social/callback/x'],
        apiEndpoints: ['https://api.twitter.com/2/tweets', 'https://api.twitter.com/2/users/me'],
      },
      linkedin: {
        platform: 'LinkedIn',
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        requiredScopes: ['openid', 'profile', 'email', 'w_member_social'],
        callbackPaths: ['/api/social/callback/linkedin'],
        apiEndpoints: ['https://api.linkedin.com/v2/userinfo', 'https://api.linkedin.com/v2/ugcPosts'],
      },
      youtube: {
        platform: 'YouTube',
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
        requiredScopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'],
        callbackPaths: ['/api/social/callback/youtube'],
        apiEndpoints: ['https://www.googleapis.com/youtube/v3/videos'],
      },
      facebook: {
        platform: 'Facebook',
        clientId: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        requiredScopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
        callbackPaths: ['/api/social/callback/facebook'],
        apiEndpoints: ['https://graph.facebook.com/v18.0/me', 'https://graph.facebook.com/v18.0/me/accounts'],
      },
      instagram: {
        platform: 'Instagram',
        clientId: process.env.FACEBOOK_APP_ID, // Uses Facebook App
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        requiredScopes: ['instagram_basic', 'instagram_content_publish'],
        callbackPaths: ['/api/social/callback/instagram'],
        apiEndpoints: ['https://graph.facebook.com/v18.0/me/accounts'],
      },
    };

    return configs[platform.toLowerCase()] || null;
  }

  /**
   * Validate a single platform configuration
   */
  async validatePlatform(platform: string): Promise<ConfigCheck> {
    const config = this.getPlatformConfig(platform);
    
    if (!config) {
      return {
        platform,
        status: 'error',
        message: `Unknown platform: ${platform}`,
      };
    }

    // Check if credentials are set
    if (!config.clientId || !config.clientSecret) {
      return {
        platform: config.platform,
        status: 'error',
        message: `Missing API credentials. Please set ${platform.toUpperCase()}_CLIENT_ID and ${platform.toUpperCase()}_CLIENT_SECRET environment variables.`,
        autoFixAvailable: false,
        fixInstructions: `Add these secrets in Replit:\n1. Click "Tools" → "Secrets"\n2. Add ${platform.toUpperCase()}_CLIENT_ID\n3. Add ${platform.toUpperCase()}_CLIENT_SECRET`,
      };
    }

    // Check callback URLs
    const callbackUrls = config.callbackPaths.map(path => `${this.baseUrl}${path}`);
    
    return {
      platform: config.platform,
      status: 'valid',
      message: `Configuration valid. Required callback URLs:\n${callbackUrls.join('\n')}`,
      fixInstructions: this.getCallbackInstructions(platform, callbackUrls),
    };
  }

  /**
   * Get platform-specific callback setup instructions
   */
  private getCallbackInstructions(platform: string, callbackUrls: string[]): string {
    const instructions: Record<string, string> = {
      twitter: `
📝 Twitter/X Setup Instructions:
1. Go to: https://developer.twitter.com/en/portal/projects-and-apps
2. Select your app
3. Click "Auth Settings" or "User authentication settings"
4. IMPORTANT: Change app name to something descriptive (e.g., "RealtyFlow", "Nebraska Home Hub")
   - App names cannot start with numbers or look like IDs
5. Add these Callback URIs:
   ${callbackUrls.join('\n   ')}
6. Set App permissions: Read and Write
7. Request these scopes: tweet.read, tweet.write, users.read, offline.access
8. Save changes`,

      linkedin: `
📝 LinkedIn Setup Instructions:
1. Go to: https://www.linkedin.com/developers/apps
2. Select your app
3. Click "Auth" tab
4. Add these Redirect URLs:
   ${callbackUrls.join('\n   ')}
5. Request these scopes: openid, profile, email, w_member_social
6. Make sure your app is verified for production use
7. Save changes`,

      youtube: `
📝 YouTube Setup Instructions:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add these Authorized redirect URIs:
   ${callbackUrls.join('\n   ')}
4. Enable YouTube Data API v3
5. Request these scopes: youtube.upload, youtube
6. Save changes`,

      facebook: `
📝 Facebook Setup Instructions:
1. Go to: https://developers.facebook.com/apps
2. Select your app
3. Click "Facebook Login" → "Settings"
4. Add these Valid OAuth Redirect URIs:
   ${callbackUrls.join('\n   ')}
5. Request permissions: pages_show_list, pages_read_engagement, pages_manage_posts
6. Submit for App Review if needed
7. Save changes`,

      instagram: `
📝 Instagram Setup Instructions:
1. Instagram uses the same Facebook App
2. Go to: https://developers.facebook.com/apps
3. Select your app
4. Click "Instagram Basic Display" or "Instagram API"
5. Add these Valid OAuth Redirect URIs:
   ${callbackUrls.join('\n   ')}
6. Request permissions: instagram_basic, instagram_content_publish
7. Save changes`,
    };

    return instructions[platform.toLowerCase()] || 'No specific instructions available';
  }

  /**
   * Validate all configured platforms
   */
  async validateAll(): Promise<ConfigCheck[]> {
    const platforms = ['twitter', 'linkedin', 'youtube', 'facebook', 'instagram'];
    const results: ConfigCheck[] = [];

    for (const platform of platforms) {
      const result = await this.validatePlatform(platform);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate configuration report
   */
  async generateReport(): Promise<string> {
    const results = await this.validateAll();
    
    let report = '═══════════════════════════════════════════════════════\n';
    report += '   SOCIAL MEDIA CONFIGURATION VALIDATION REPORT\n';
    report += '═══════════════════════════════════════════════════════\n\n';
    report += `Base URL: ${this.baseUrl}\n\n`;

    for (const result of results) {
      const statusIcon = result.status === 'valid' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      
      report += `${statusIcon} ${result.platform}\n`;
      report += `   Status: ${result.status.toUpperCase()}\n`;
      report += `   ${result.message}\n`;
      
      if (result.fixInstructions) {
        report += `\n${result.fixInstructions}\n`;
      }
      
      report += '\n───────────────────────────────────────────────────────\n\n';
    }

    const validCount = results.filter(r => r.status === 'valid').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    report += `\nSummary: ${validCount}/${results.length} platforms configured, ${errorCount} errors\n`;
    report += '═══════════════════════════════════════════════════════\n';

    return report;
  }

  /**
   * Check if BASE_URL is properly configured
   */
  validateBaseUrl(): ConfigCheck {
    if (!this.baseUrl || this.baseUrl === 'http://localhost:5000') {
      return {
        platform: 'BASE_URL',
        status: 'warning',
        message: 'Using localhost URL. Update BASE_URL environment variable for production.',
        fixInstructions: 'Set BASE_URL to your Replit domain (e.g., https://your-app.replit.dev)',
      };
    }

    if (!this.baseUrl.startsWith('https://')) {
      return {
        platform: 'BASE_URL',
        status: 'error',
        message: 'BASE_URL must use HTTPS for OAuth callbacks',
        fixInstructions: 'Update BASE_URL to use https:// protocol',
      };
    }

    return {
      platform: 'BASE_URL',
      status: 'valid',
      message: `BASE_URL configured: ${this.baseUrl}`,
    };
  }
}

/**
 * CLI interface for configuration validation
 */
export async function runConfigValidation() {
  const validator = new SocialConfigValidator();
  const report = await validator.generateReport();
  console.log(report);
  
  // Check BASE_URL separately
  const baseUrlCheck = validator.validateBaseUrl();
  console.log(`\n${baseUrlCheck.status === 'valid' ? '✅' : '⚠️'} BASE_URL Check:`);
  console.log(`   ${baseUrlCheck.message}`);
  if (baseUrlCheck.fixInstructions) {
    console.log(`   Fix: ${baseUrlCheck.fixInstructions}`);
  }
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  runConfigValidation().catch(console.error);
}
