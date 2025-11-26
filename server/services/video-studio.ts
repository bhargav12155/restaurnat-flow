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
   * Create an avatar from an uploaded image
   */
  async createAvatarFromImage(
    imageUrl: string,
    name: string
  ): Promise<StudioAvatar> {
    console.log("🎭 Video Studio: Creating avatar from image...");

    const response = await this.heygenService.createTalkingPhotoAvatar(
      imageUrl,
      name
    );

    const data = response.data as any;
    const avatarId =
      data?.avatar_group_id ||
      data?.avatar_id ||
      data?.group_id;

    if (!avatarId) {
      throw new Error("Failed to create avatar - no ID returned");
    }

    return {
      id: avatarId,
      name: name,
      type: "photo",
      previewUrl: imageUrl,
    };
  }

  /**
   * Upload an image file and get a HeyGen-compatible URL
   */
  async uploadImage(imageBlob: Blob): Promise<string> {
    return this.heygenService.uploadImage(imageBlob);
  }

  /**
   * List all available avatars (both preset and custom)
   */
  async listAvatars(): Promise<StudioAvatar[]> {
    console.log("🎭 Video Studio: Fetching available avatars...");

    const response = await this.heygenService.listAvatars();
    const avatars: StudioAvatar[] = [];

    if (response.data?.avatars) {
      for (const avatar of response.data.avatars) {
        avatars.push({
          id: avatar.avatar_id,
          name: avatar.avatar_name || avatar.name || "Unnamed Avatar",
          type: avatar.avatar_type === "talking_photo" ? "photo" : "preset",
          thumbnailUrl: avatar.preview_image_url || avatar.thumbnail_url,
          previewUrl: avatar.preview_video_url,
        });
      }
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
