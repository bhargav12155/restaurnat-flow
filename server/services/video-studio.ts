/**
 * Unified Video Studio Service
 * 
 * Consolidates all HeyGen video generation flows into one simple interface:
 * 1. UPLOAD - Create avatar from image or select existing
 * 2. ASK - Provide script or generate from topic
 * 3. GET IT - Generate and retrieve video
 * 
 * This replaces the fragmented heygen.ts, heygen-photo-avatar.ts, heygen-template.ts, etc.
 */

import { HeyGenService } from "./heygen";
import { HeyGenPhotoAvatarService } from "./heygen-photo-avatar";

export interface StudioAvatar {
  id: string;
  name: string;
  type: "preset" | "photo" | "custom";
  previewUrl?: string;
  thumbnailUrl?: string;
  groupId?: string; // For avatars that belong to a group
  avatarType?: "avatar" | "talking_photo"; // HeyGen character type for video generation
  defaultVoiceId?: string; // Default voice for this avatar (from group or avatar)
}

export interface VideoGenerationRequest {
  avatarId: string;
  avatarType?: "avatar" | "talking_photo";
  script: string;
  title?: string;
  voiceId?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  quality?: "1080p" | "720p" | "480p";
  gestureIntensity?: number;
}

export interface VideoStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface QuickVideoRequest {
  imageUrl?: string;
  avatarId?: string;
  topic?: string;
  script?: string;
  title?: string;
  voiceId?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

export class VideoStudioService {
  private heygenService: HeyGenService;
  private photoAvatarService: HeyGenPhotoAvatarService;
  private apiKey: string;
  private baseUrl = "https://api.heygen.com";

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error("HEYGEN_API_KEY is not set");
    }
    this.apiKey = apiKey;
    this.heygenService = new HeyGenService();
    this.photoAvatarService = new HeyGenPhotoAvatarService();
  }

  /**
   * STEP 1: UPLOAD
   * Create a talking photo avatar from an uploaded image
   * Uses the simpler /v1/talking_photo endpoint that works with Pro/Scale plans
   */
  async createAvatarFromImage(
    imageUrl: string,
    name: string
  ): Promise<StudioAvatar> {
    console.log("🎭 Video Studio: Creating talking photo from image...");

    // First, download the image from the URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await imageResponse.arrayBuffer();
    
    console.log(`🎭 Video Studio: Downloaded image, size: ${imageBuffer.byteLength} bytes, type: ${contentType}`);
    
    // Use the simpler talking photo upload (works with Pro/Scale plans)
    const response = await this.heygenService.uploadTalkingPhoto(
      Buffer.from(imageBuffer),
      contentType
    );

    const data = response.data as any;
    const avatarId =
      data?.talking_photo_id ||
      data?.avatar_id ||
      data?.avatar_group_id ||
      data?.group_id;

    if (!avatarId) {
      console.error("🎭 Video Studio: Response data:", JSON.stringify(response, null, 2));
      throw new Error("Failed to create talking photo - no ID returned");
    }

    console.log(`🎭 Video Studio: Talking photo created with ID: ${avatarId}`);

    return {
      id: avatarId,
      name: name,
      type: "photo",
      previewUrl: data?.talking_photo_url || imageUrl,
    };
  }

  /**
   * STEP 1 (Alternative): Create avatar directly from image buffer
   * This avoids the need to upload to HeyGen first and then download
   */
  async createAvatarFromBuffer(
    imageBuffer: Buffer,
    name: string,
    contentType: string = "image/jpeg"
  ): Promise<StudioAvatar> {
    console.log("🎭 Video Studio: Creating talking photo from buffer...");
    
    const response = await this.heygenService.uploadTalkingPhoto(imageBuffer, contentType);

    const data = response.data as any;
    const avatarId =
      data?.talking_photo_id ||
      data?.avatar_id ||
      data?.avatar_group_id;

    if (!avatarId) {
      console.error("🎭 Video Studio: Response data:", JSON.stringify(response, null, 2));
      throw new Error("Failed to create talking photo - no ID returned");
    }

    console.log(`🎭 Video Studio: Talking photo created with ID: ${avatarId}`);

    return {
      id: avatarId,
      name: name,
      type: "photo",
      previewUrl: data?.talking_photo_url,
    };
  }

  /**
   * Upload an image file and get a HeyGen-compatible URL
   */
  async uploadImage(imageBlob: Blob): Promise<string> {
    return this.heygenService.uploadImage(imageBlob);
  }

  /**
   * Fetch all avatars from HeyGen and find ones matching a group ID
   * Instant avatars appear in the main /v2/avatars list
   */
  private async fetchAvatarIdForGroup(groupId: string, groupName: string): Promise<string | null> {
    try {
      // Instant avatars appear in /v2/avatars with avatar_id matching or containing group info
      const response = await fetch(`${this.baseUrl}/v2/avatars`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`🎭 Video Studio: Failed to fetch avatars list:`, response.status);
        return null;
      }

      const data = await response.json();
      const allAvatars = data.data?.avatars || [];
      
      // Look for avatar that matches the group ID or name
      // Instant avatars often have avatar_id that relates to the group
      const matchingAvatar = allAvatars.find((avatar: any) => 
        avatar.avatar_id === groupId ||
        avatar.avatar_group_id === groupId ||
        avatar.group_id === groupId ||
        (avatar.avatar_name && avatar.avatar_name.toLowerCase() === groupName.toLowerCase())
      );

      if (matchingAvatar) {
        console.log(`🎭 Video Studio: Found matching avatar: ${matchingAvatar.avatar_id} for group ${groupName}`);
        return matchingAvatar.avatar_id;
      }

      return null;
    } catch (error) {
      console.warn(`🎭 Video Studio: Error finding avatar for group ${groupId}:`, error);
      return null;
    }
  }

  /**
   * List only custom avatars (user-created, not HeyGen's stock library)
   * Filters for PRIVATE groups (instant avatars) and trained PHOTO groups
   * IMPORTANT: Returns actual avatar IDs that can be used for video generation
   */
  async listAvatars(): Promise<StudioAvatar[]> {
    console.log("🎭 Video Studio: Fetching custom avatars only...");

    const avatars: StudioAvatar[] = [];

    try {
      // First, get all avatar groups to identify user's custom avatars
      const groupsResponse = await fetch(`${this.baseUrl}/v2/avatar_group.list`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!groupsResponse.ok) {
        console.error("🎭 Video Studio: Failed to fetch avatar groups:", groupsResponse.status);
        return avatars;
      }

      const groupsData = await groupsResponse.json();
      const groups = groupsData.data?.avatar_group_list || groupsData.data?.avatar_groups || [];

      console.log(`🎭 Video Studio: Found ${groups.length} total avatar groups`);

      // Get the full avatars list to find actual avatar IDs
      const avatarsResponse = await fetch(`${this.baseUrl}/v2/avatars`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      let allAvatars: any[] = [];
      if (avatarsResponse.ok) {
        const avatarsData = await avatarsResponse.json();
        allAvatars = avatarsData.data?.avatars || [];
        console.log(`🎭 Video Studio: Found ${allAvatars.length} total avatars in HeyGen account`);
        
        // Log first few avatars to understand the structure
        const sampleAvatars = allAvatars.slice(0, 5);
        for (const avatar of sampleAvatars) {
          console.log(`🎭 Sample avatar: id=${avatar.avatar_id}, name=${avatar.avatar_name}, type=${avatar.avatar_type}, group_id=${avatar.avatar_group_id || avatar.group_id || 'none'}`);
        }
      }

      // Filter for PRIVATE groups (instant avatars from video training)
      const privateGroups = groups.filter((group: any) => group.group_type === "PRIVATE");
      console.log(`🎭 Video Studio: Found ${privateGroups.length} PRIVATE (instant avatar) groups`);

      // For PRIVATE groups, find the matching avatar in the avatars list
      // According to HeyGen docs, instant avatars are found by NAME in the avatars list
      for (const group of privateGroups) {
        // Try multiple matching strategies
        const matchingAvatar = allAvatars.find((avatar: any) => {
          // Match by group ID
          if (avatar.avatar_group_id === group.id || avatar.group_id === group.id) return true;
          // Match by avatar_id containing group ID
          if (avatar.avatar_id?.includes(group.id)) return true;
          // Match by name (case-insensitive)
          if (avatar.avatar_name?.toLowerCase() === group.name?.toLowerCase()) return true;
          // Match by avatar_type being instant_avatar with similar name
          if (avatar.avatar_type === 'instant_avatar' && avatar.avatar_name?.includes(group.name?.split(' ')[0])) return true;
          return false;
        });

        if (matchingAvatar) {
          console.log(`🎭 Video Studio: Found matching avatar for "${group.name}": id=${matchingAvatar.avatar_id}, type=${matchingAvatar.avatar_type}`);
          avatars.push({
            id: matchingAvatar.avatar_id,
            name: group.name || matchingAvatar.avatar_name || "Custom Avatar",
            type: "custom",
            thumbnailUrl: matchingAvatar.preview_image_url || group.preview_image,
            previewUrl: matchingAvatar.preview_video_url || group.preview_video,
            groupId: group.id,
            avatarType: "avatar",
            defaultVoiceId: group.default_voice_id, // Include the default voice for this avatar
          });
        } else {
          // Log all instant_avatar type avatars for debugging
          const instantAvatars = allAvatars.filter((a: any) => a.avatar_type === 'instant_avatar');
          console.log(`🎭 Video Studio: No match found for "${group.name}". Instant avatars available: ${instantAvatars.map((a: any) => `${a.avatar_name}(${a.avatar_id})`).join(', ') || 'none'}`);
          
          // Still add the group, using group ID as fallback
          console.log(`🎭 Video Studio: Using group ID ${group.id} as avatar ID for ${group.name}`);
          avatars.push({
            id: group.id,
            name: group.name || "Custom Avatar",
            type: "custom",
            thumbnailUrl: group.preview_image,
            previewUrl: group.preview_video,
            groupId: group.id,
            avatarType: "avatar",
            defaultVoiceId: group.default_voice_id,
          });
        }
      }

      // Filter for ALL PHOTO groups (include both trained and empty - they can still be used for video generation)
      // Also include GENERATED_PHOTO groups (AI-generated photo avatars)
      const photoGroups = groups.filter(
        (group: any) => group.group_type === "PHOTO" || group.group_type === "GENERATED_PHOTO"
      );
      console.log(`🎭 Video Studio: Found ${photoGroups.length} PHOTO/GENERATED_PHOTO avatar groups`);

      // For PHOTO groups, find the matching avatar
      for (const group of photoGroups) {
        const matchingAvatar = allAvatars.find((avatar: any) => 
          avatar.avatar_group_id === group.id ||
          avatar.group_id === group.id
        );

        if (matchingAvatar) {
          avatars.push({
            id: matchingAvatar.avatar_id,
            name: group.name || matchingAvatar.avatar_name || "Photo Avatar",
            type: "photo",
            thumbnailUrl: matchingAvatar.preview_image_url || group.preview_image,
            previewUrl: matchingAvatar.preview_video_url || group.preview_video,
            groupId: group.id,
            avatarType: "avatar",
          });
        } else {
          // For trained photo avatars, use the group ID
          avatars.push({
            id: group.id,
            name: group.name || "Photo Avatar",
            type: "photo",
            thumbnailUrl: group.preview_image,
            previewUrl: group.preview_video,
            groupId: group.id,
            avatarType: "talking_photo", // Photo avatars use talking_photo type
          });
        }
      }

      // Also fetch user's talking photos (simple photo uploads)
      try {
        const talkingPhotosResponse = await fetch(`${this.baseUrl}/v1/talking_photo.list`, {
          method: "GET",
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
        });

        if (talkingPhotosResponse.ok) {
          const talkingPhotosData = await talkingPhotosResponse.json();
          const talkingPhotos = talkingPhotosData.data?.talking_photos || [];
          console.log(`🎭 Video Studio: Found ${talkingPhotos.length} talking photos`);

          for (const photo of talkingPhotos) {
            avatars.push({
              id: photo.talking_photo_id,
              name: photo.talking_photo_name || "Talking Photo",
              type: "photo",
              thumbnailUrl: photo.preview_image_url || photo.image_url,
              previewUrl: photo.preview_video_url,
              avatarType: "talking_photo",
            });
          }
        }
      } catch (talkingPhotoError) {
        console.warn("🎭 Video Studio: Could not fetch talking photos:", talkingPhotoError);
      }

      console.log(`🎭 Video Studio: Returning ${avatars.length} custom avatars total`);

    } catch (error) {
      console.error("🎭 Video Studio: Error fetching custom avatars:", error);
    }

    return avatars;
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<any[]> {
    console.log("🎤 Video Studio: Fetching available voices...");
    const response = await this.heygenService.listVoices();
    return response.data?.voices || [];
  }

  /**
   * STEP 2: ASK
   * Generate a script from a topic (uses OpenAI)
   */
  async generateScript(
    topic: string,
    type: "marketing" | "educational" | "social" = "marketing",
    duration: number = 60
  ): Promise<string> {
    console.log("📝 Video Studio: Generating script for topic:", topic);

    const prompt = this.buildScriptPrompt(topic, type, duration);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are a professional video script writer. Write concise, engaging scripts for AI avatar videos. Keep scripts under 1500 characters for optimal video generation.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || this.getFallbackScript(topic);
    } catch (error) {
      console.error("Script generation failed, using fallback:", error);
      return this.getFallbackScript(topic);
    }
  }

  private buildScriptPrompt(
    topic: string,
    type: string,
    duration: number
  ): string {
    const wordCount = Math.round(duration * 2.5); // ~150 words per minute

    return `Write a ${type} video script about: "${topic}"

Requirements:
- Duration: approximately ${duration} seconds (~${wordCount} words)
- Start with a hook that grabs attention
- Keep it conversational and natural
- End with a clear call-to-action
- Maximum 1500 characters

Write only the script text, no stage directions or notes.`;
  }

  private getFallbackScript(topic: string): string {
    return `Hey there! I'm excited to talk to you about ${topic}. 

This is a topic that can really make a difference in your life. Whether you're just getting started or looking to level up, there's something here for everyone.

Let me break it down for you in a way that's easy to understand and actionable.

The key is to stay curious, keep learning, and take action on what you discover.

Thanks for watching! If you found this helpful, don't forget to like and subscribe for more content like this.`;
  }

  /**
   * STEP 3: GET IT
   * Generate a video with the given parameters
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoStatus> {
    console.log("🎬 Video Studio: Starting video generation...");
    console.log("📋 Request:", JSON.stringify(request, null, 2));

    const response = await this.heygenService.generateVideo({
      avatarId: request.avatarId,
      script: request.script,
      title: request.title || "Video Studio Generation",
      voiceId: request.voiceId,
      aspectRatio: request.aspectRatio || "16:9",
      quality: request.quality || "720p",
      isTalkingPhoto: request.avatarType === "talking_photo",
      gestureIntensity: request.gestureIntensity || 0,
    });

    if (!response.data?.video_id) {
      throw new Error("Video generation failed - no video ID returned");
    }

    console.log("✅ Video generation started:", response.data.video_id);

    return {
      id: response.data.video_id,
      status: "processing",
      progress: 0,
    };
  }

  /**
   * Check video generation status
   */
  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    console.log("📊 Video Studio: Checking status for video:", videoId);

    const response = await this.heygenService.getVideoStatus(videoId);

    let status: VideoStatus["status"] = "processing";
    if (response.status === "completed") {
      status = "completed";
    } else if (response.status === "failed") {
      status = "failed";
    } else if (response.status === "pending") {
      status = "pending";
    }

    return {
      id: videoId,
      status,
      videoUrl: response.video_url,
      thumbnailUrl: response.thumbnail_url,
      error: response.error,
    };
  }

  /**
   * ALL-IN-ONE: Quick video generation
   * Handles the entire flow: Upload → Ask → Get It
   */
  async quickGenerate(request: QuickVideoRequest): Promise<VideoStatus> {
    console.log("🚀 Video Studio: Quick generation starting...");

    let avatarId = request.avatarId;
    let avatarType: "avatar" | "talking_photo" = "avatar";

    if (request.imageUrl && !request.avatarId) {
      console.log("📸 Step 1: Creating avatar from image...");
      const avatar = await this.createAvatarFromImage(
        request.imageUrl,
        request.title || "Quick Avatar"
      );
      avatarId = avatar.id;
      avatarType = "talking_photo";
    }

    if (!avatarId) {
      throw new Error("Either imageUrl or avatarId is required");
    }

    let script = request.script;
    if (!script && request.topic) {
      console.log("📝 Step 2: Generating script from topic...");
      script = await this.generateScript(request.topic);
    }

    if (!script) {
      throw new Error("Either script or topic is required");
    }

    console.log("🎬 Step 3: Generating video...");
    return this.generateVideo({
      avatarId,
      avatarType,
      script,
      title: request.title,
      voiceId: request.voiceId,
      aspectRatio: request.aspectRatio,
    });
  }

  /**
   * Poll video status until complete or failed
   */
  async waitForCompletion(
    videoId: string,
    maxWaitMs: number = 300000,
    pollIntervalMs: number = 5000
  ): Promise<VideoStatus> {
    console.log(`⏳ Video Studio: Waiting for video ${videoId} to complete...`);

    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getVideoStatus(videoId);

      if (status.status === "completed") {
        console.log("✅ Video completed:", status.videoUrl);
        return status;
      }

      if (status.status === "failed") {
        console.error("❌ Video generation failed:", status.error);
        throw new Error(`Video generation failed: ${status.error}`);
      }

      console.log(`⏳ Still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Video generation timeout after ${maxWaitMs / 1000} seconds`);
  }
}

export const videoStudioService = new VideoStudioService();
