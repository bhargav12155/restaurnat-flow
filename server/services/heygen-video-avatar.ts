/**
 * HeyGen Video Avatar API Service
 * Enterprise-only feature for creating high-fidelity avatars from training footage
 *
 * Workflow:
 * 1. Upload training footage (2+ min, 720p+) and consent statement to public URL
 * 2. Submit video avatar creation request
 * 3. Monitor status until complete
 * 4. Use avatar_id in video generation
 *
 * @see https://docs.heygen.com/docs/video-avatars-api
 */

interface VideoAvatarCreationRequest {
  avatar_name: string;
  training_footage_url: string;
  video_consent_url: string;
  avatar_group_id?: string; // Optional: ID of existing avatar group
  callback_id?: string; // Optional: Custom ID for callback tracking
  callback_url?: string; // Optional: URL to notify when complete
}

interface VideoAvatarCreationResponse {
  code: number;
  data: {
    avatar_id: string;
    avatar_name: string;
    status: "in_progress" | "complete" | "failed";
    created_at: string;
  };
  message?: string;
}

interface VideoAvatarStatusResponse {
  code: number;
  data: {
    avatar_id: string;
    avatar_name: string;
    status: "in_progress" | "complete" | "failed";
    progress?: number; // Percentage 0-100
    error_message?: string;
    thumbnail_url?: string;
    preview_video_url?: string;
    created_at: string;
    updated_at: string;
  };
  message?: string;
}

interface VideoAvatarListResponse {
  code: number;
  data: {
    avatars: Array<{
      avatar_id: string;
      avatar_name: string;
      avatar_type: string; // 'instant_avatar', 'public', 'talking_photo'
      gender?: string;
      preview_image_url?: string;
      preview_video_url?: string;
    }>;
  };
  message?: string;
}

export class HeyGenVideoAvatarService {
  private apiKey: string;
  private baseUrl = "https://api.heygen.com/v2";

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error("HEYGEN_API_KEY is not set in environment variables");
    }
    this.apiKey = apiKey;
  }

  private async makeRequest(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    console.log(`🎬 HeyGen Video Avatar API: ${method} ${url}`);
    if (body) {
      console.log("📦 Request body:", JSON.stringify(body, null, 2));
    }

    const response = await fetch(url, {
      method,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(
      `📡 Response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HeyGen Video Avatar API error:`, errorText);

      // Special handling for 403 errors (Enterprise feature)
      if (response.status === 403) {
        throw new Error(
          `Video Avatar API is an Enterprise-only feature. Your HeyGen account may not have access. ` +
            `Please contact HeyGen support to enable Enterprise API features. Error: ${errorText}`
        );
      }

      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.message || errorJson.error || errorText;
        throw new Error(
          `HeyGen Video Avatar API error (${response.status}): ${errorMessage}`
        );
      } catch {
        throw new Error(
          `HeyGen Video Avatar API error: ${response.status} - ${errorText}`
        );
      }
    }

    const result = await response.json();
    console.log("✅ Response:", JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Submit Video Avatar Creation Request
   *
   * Creates a high-fidelity avatar from training footage
   *
   * Requirements:
   * - Training footage: MP4, 2+ minutes, 720p or higher
   * - Consent statement: MP4 with explicit permission
   * - Both files must be publicly accessible URLs
   *
   * @param request Avatar creation parameters
   * @returns Avatar ID and initial status
   */
  async createVideoAvatar(
    request: VideoAvatarCreationRequest
  ): Promise<VideoAvatarCreationResponse> {
    console.log("🎬 Creating video avatar:", request.avatar_name);

    // Validate URLs
    if (!request.training_footage_url.startsWith("http")) {
      throw new Error("Training footage URL must be a valid HTTP/HTTPS URL");
    }
    if (!request.video_consent_url.startsWith("http")) {
      throw new Error("Consent video URL must be a valid HTTP/HTTPS URL");
    }

    // Properly encode URLs to handle special characters
    const encodedTrainingUrl = encodeURI(request.training_footage_url);
    const encodedConsentUrl = encodeURI(request.video_consent_url);

    const payload: any = {
      avatar_name: request.avatar_name,
      training_footage_url: encodedTrainingUrl,
      video_consent_url: encodedConsentUrl,
    };

    // Add optional fields if provided
    if (request.avatar_group_id)
      payload.avatar_group_id = request.avatar_group_id;
    if (request.callback_id) payload.callback_id = request.callback_id;
    if (request.callback_url) payload.callback_url = request.callback_url;

    const response = await this.makeRequest("/video_avatar", "POST", payload);

    return response;
  }

  /**
   * Check Video Avatar Generation Status
   *
   * Monitor the progress of avatar creation
   *
   * Status values:
   * - in_progress: Avatar is being processed
   * - complete: Avatar ready to use
   * - failed: Processing failed (check error_message)
   *
   * @param avatarId The avatar ID from creation request
   * @returns Current status and details
   */
  async checkVideoAvatarStatus(
    avatarId: string
  ): Promise<VideoAvatarStatusResponse> {
    console.log("📊 Checking video avatar status:", avatarId);

    const response = await this.makeRequest(`/video_avatar/${avatarId}/status`);

    return response;
  }

  /**
   * List All Video Avatars (Instant Avatars)
   *
   * Retrieve all avatars from your account and filter for instant avatars
   * Uses the /avatars endpoint which returns all avatar types
   *
   * @returns List of video avatars with their status
   */
  async listVideoAvatars(): Promise<VideoAvatarListResponse> {
    console.log("📋 Listing all avatars from HeyGen");

    const response = await this.makeRequest("/avatars");

    // Log the full structure to understand what HeyGen returns
    console.log("📋 HeyGen response data keys:", Object.keys(response.data || {}));
    
    const allAvatars: any[] = [];
    
    // The /v2/avatars endpoint returns different arrays:
    // - 'avatars': Contains standard avatars with avatar_id and avatar_type
    // - 'talking_photos': Contains photo avatars with talking_photo_id
    
    // Check for avatars array (includes instant avatars, public avatars, etc.)
    if (response.data?.avatars && Array.isArray(response.data.avatars)) {
      console.log(`📋 Found ${response.data.avatars.length} items in 'avatars' array`);
      
      // Log first avatar to understand structure
      if (response.data.avatars.length > 0) {
        const sample = response.data.avatars[0];
        console.log("📋 Sample avatar keys:", Object.keys(sample));
        console.log("📋 Sample avatar_type values in first 10:", 
          response.data.avatars.slice(0, 10).map((a: any) => a.avatar_type)
        );
      }
      
      // Filter for custom avatars only (not public/stock avatars)
      // HeyGen returns avatars with various types: 'public', 'private', 'custom', 'instant_avatar'
      const customAvatars = response.data.avatars.filter((avatar: any) => {
        // Check multiple indicators that this is a user-created avatar
        const isInstant = avatar.avatar_type === 'instant_avatar';
        const isPrivate = avatar.avatar_type === 'private';
        const isCustom = avatar.avatar_type === 'custom';
        const notPublic = avatar.is_public === false;
        const isCustomerAvatar = avatar.is_customer_avatar === true;
        
        const shouldInclude = isInstant || isPrivate || isCustom || notPublic || isCustomerAvatar;
        
        if (shouldInclude) {
          console.log(`📋 Found custom avatar: ${avatar.avatar_name} (type: ${avatar.avatar_type}, is_public: ${avatar.is_public})`);
        }
        return shouldInclude;
      });
      
      console.log(`📋 Found ${customAvatars.length} custom avatars out of ${response.data.avatars.length} total`);
      allAvatars.push(...customAvatars);
    }
    
    // Check for talking_photos array (photo avatars)
    // These have talking_photo_id format instead of avatar_id
    if (response.data?.talking_photos && Array.isArray(response.data.talking_photos)) {
      console.log(`📋 Found ${response.data.talking_photos.length} talking photos`);
      
      // Log sample talking photo structure
      if (response.data.talking_photos.length > 0) {
        const sample = response.data.talking_photos[0];
        console.log("📋 Sample talking_photo keys:", Object.keys(sample));
      }
      
      // Include talking photos as they can be used for video generation
      // Transform them to match the avatar format
      const talkingPhotoAvatars = response.data.talking_photos.map((tp: any) => ({
        avatar_id: tp.talking_photo_id,
        avatar_name: tp.talking_photo_name,
        avatar_type: 'talking_photo',
        preview_image_url: tp.preview_image_url,
        preview_video_url: tp.preview_video_url,
      }));
      
      // Add talking photos to the list - these ARE user-accessible avatars
      allAvatars.push(...talkingPhotoAvatars);
    }
    
    // Also check avatar groups for custom avatars
    try {
      const groupsResponse = await this.listAvatarGroups();
      if (groupsResponse.data?.avatar_groups && Array.isArray(groupsResponse.data.avatar_groups)) {
        console.log(`📋 Found ${groupsResponse.data.avatar_groups.length} avatar groups`);
        
        // Fetch avatars from each group
        for (const group of groupsResponse.data.avatar_groups) {
          console.log(`📋 Checking group: ${group.group_name || group.id}`);
          const groupAvatars = await this.listAvatarsInGroup(group.id);
          
          if (groupAvatars.data?.avatars && Array.isArray(groupAvatars.data.avatars)) {
            console.log(`📋 Found ${groupAvatars.data.avatars.length} avatars in group ${group.group_name || group.id}`);
            
            // Add these avatars with proper formatting
            const formattedAvatars = groupAvatars.data.avatars.map((avatar: any) => ({
              avatar_id: avatar.avatar_id,
              avatar_name: avatar.avatar_name,
              avatar_type: avatar.avatar_type || 'custom',
              preview_image_url: avatar.preview_image_url,
              preview_video_url: avatar.preview_video_url,
              group_id: group.id,
              group_name: group.group_name,
            }));
            
            allAvatars.push(...formattedAvatars);
          }
        }
      }
    } catch (groupError) {
      console.log("📋 Could not fetch avatar groups:", groupError);
    }

    console.log(`📋 Total avatars for Video Avatar Manager: ${allAvatars.length}`);
    
    return {
      ...response,
      data: {
        avatars: allAvatars.map((avatar: any) => ({
          avatar_id: avatar.avatar_id,
          avatar_name: avatar.avatar_name,
          avatar_type: avatar.avatar_type || 'instant_avatar',
          gender: avatar.gender,
          preview_image_url: avatar.preview_image_url,
          preview_video_url: avatar.preview_video_url,
          is_public: avatar.is_public,
          is_customer_avatar: avatar.is_customer_avatar,
        }))
      }
    };
  }

  /**
   * List All Avatar Groups
   * 
   * Retrieves all avatar groups from the account
   * Avatar groups contain custom avatars created by the user
   */
  async listAvatarGroups(): Promise<any> {
    console.log("📋 Listing avatar groups from HeyGen");
    
    try {
      const response = await this.makeRequest("/avatar_group.list");
      console.log("📋 Avatar groups response:", JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error("❌ Failed to list avatar groups:", error);
      return { data: { avatar_groups: [] } };
    }
  }

  /**
   * List Avatars in a Group
   * 
   * Retrieves all avatars in a specific avatar group
   */
  async listAvatarsInGroup(groupId: string): Promise<any> {
    console.log(`📋 Listing avatars in group: ${groupId}`);
    
    try {
      const response = await this.makeRequest(`/avatar_group/${groupId}/avatars`);
      console.log(`📋 Avatars in group ${groupId}:`, JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error(`❌ Failed to list avatars in group ${groupId}:`, error);
      return { data: { avatars: [] } };
    }
  }

  /**
   * Delete Video Avatar
   *
   * Permanently remove a video avatar
   *
   * @param avatarId The avatar ID to delete
   * @returns Success confirmation
   */
  async deleteVideoAvatar(avatarId: string): Promise<{ success: boolean }> {
    console.log("🗑️ Deleting video avatar:", avatarId);

    const response = await this.makeRequest(
      `/video_avatar/${avatarId}`,
      "DELETE"
    );

    return {
      success: response.code === 100,
    };
  }

  /**
   * Poll Video Avatar Status Until Complete
   *
   * Utility method to wait for avatar creation to finish
   *
   * @param avatarId Avatar ID to monitor
   * @param maxAttempts Maximum polling attempts (default: 60)
   * @param intervalMs Polling interval in milliseconds (default: 10000 = 10s)
   * @returns Final status when complete or failed
   */
  async waitForAvatarCompletion(
    avatarId: string,
    maxAttempts: number = 60, // 10 minutes max
    intervalMs: number = 10000
  ): Promise<VideoAvatarStatusResponse> {
    console.log(
      `⏳ Waiting for avatar ${avatarId} to complete (max ${maxAttempts} attempts)`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const status = await this.checkVideoAvatarStatus(avatarId);

      console.log(
        `Attempt ${attempt}/${maxAttempts}: Status = ${status.data.status}${
          status.data.progress ? ` (${status.data.progress}%)` : ""
        }`
      );

      if (status.data.status === "complete") {
        console.log("✅ Avatar creation completed!");
        return status;
      }

      if (status.data.status === "failed") {
        console.error("❌ Avatar creation failed:", status.data.error_message);
        throw new Error(`Avatar creation failed: ${status.data.error_message}`);
      }

      // Wait before next check
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error(`Avatar creation timeout after ${maxAttempts} attempts`);
  }

  /**
   * Validate Training Footage Requirements
   *
   * Helper to check if video meets minimum requirements
   * Note: This only checks basic requirements, not actual content quality
   *
   * @param videoUrl URL to the training footage
   * @returns Validation result
   */
  async validateTrainingFootage(videoUrl: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check URL format
    if (!videoUrl.startsWith("http")) {
      issues.push("URL must be a valid HTTP/HTTPS URL");
    }

    // Check file extension
    if (!videoUrl.toLowerCase().endsWith(".mp4")) {
      issues.push("Training footage must be MP4 format");
    }

    // Note: Actual duration and resolution checks require downloading the video
    // which should be done client-side before upload

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export default HeyGenVideoAvatarService;
