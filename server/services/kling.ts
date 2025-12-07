import { decryptApiKey } from "./encryption";

interface KlingImageToVideoRequest {
  imageUrl: string;
  prompt: string;
  duration?: "5" | "10";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  negativePrompt?: string;
  cfgScale?: number;
}

interface KlingGenerationResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

interface KlingTaskStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  error?: string;
}

export class KlingService {
  private apiKey: string;
  private baseUrl = "https://api.aimlapi.com/v2/generate/video/kling";

  constructor(encryptedApiKey: string) {
    const decryptedKey = decryptApiKey(encryptedApiKey);
    if (!decryptedKey) {
      throw new Error("Failed to decrypt Kling API key");
    }
    this.apiKey = decryptedKey;
  }

  async generateImageToVideo(request: KlingImageToVideoRequest): Promise<KlingGenerationResult> {
    try {
      console.log("🎬 Kling: Starting image-to-video generation...");
      console.log("📸 Image URL:", request.imageUrl);
      console.log("📝 Prompt:", request.prompt);

      const response = await fetch(`${this.baseUrl}/generation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kling-video/v1.6/pro/image-to-video",
          image_url: request.imageUrl,
          prompt: request.prompt,
          duration: parseInt(request.duration || "5"),
          negative_prompt: request.negativePrompt || "blur, distort, low quality, pixelated",
          cfg_scale: request.cfgScale || 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Kling API error:", response.status, errorText);
        return {
          success: false,
          error: `Kling API error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log("✅ Kling task submitted:", result);

      if (result.status === "completed" && result.video?.url) {
        return {
          success: true,
          videoUrl: result.video.url,
          taskId: result.id,
          status: "completed",
        };
      }

      return {
        success: true,
        taskId: result.id,
        status: result.status === "processing" ? "processing" : "pending",
      };
    } catch (error) {
      console.error("❌ Kling generation error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async checkTaskStatus(taskId: string): Promise<KlingTaskStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/generation?generation_id=${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: "failed",
          error: `Failed to check status: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      console.log("📊 Kling task status:", result.id, result.status);

      if (result.status === "completed" && result.video?.url) {
        return {
          status: "completed",
          videoUrl: result.video.url,
        };
      }

      if (result.status === "failed" || result.error) {
        return {
          status: "failed",
          error: result.error || "Generation failed",
        };
      }

      return {
        status: result.status === "queued" ? "pending" : "processing",
        progress: result.progress || undefined,
      };
    } catch (error) {
      console.error("❌ Error checking Kling task status:", error);
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async waitForCompletion(taskId: string, maxWaitMs: number = 300000): Promise<KlingTaskStatus> {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkTaskStatus(taskId);

      if (status.status === "completed" || status.status === "failed") {
        return status;
      }

      console.log(`⏳ Kling task ${taskId} still ${status.status}, waiting...`);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return {
      status: "failed",
      error: "Timeout waiting for video generation",
    };
  }
}

export async function generateMotionVideo(
  encryptedApiKey: string,
  imageUrl: string,
  prompt: string,
  options?: {
    duration?: "5" | "10";
    aspectRatio?: "16:9" | "9:16" | "1:1";
    waitForCompletion?: boolean;
  }
): Promise<KlingGenerationResult> {
  const service = new KlingService(encryptedApiKey);

  const result = await service.generateImageToVideo({
    imageUrl,
    prompt,
    duration: options?.duration || "5",
    aspectRatio: options?.aspectRatio,
  });

  if (!result.success || !result.taskId) {
    return result;
  }

  if (options?.waitForCompletion) {
    const finalStatus = await service.waitForCompletion(result.taskId);
    return {
      success: finalStatus.status === "completed",
      videoUrl: finalStatus.videoUrl,
      taskId: result.taskId,
      status: finalStatus.status,
      error: finalStatus.error,
    };
  }

  return result;
}
