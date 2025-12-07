import { decryptApiKey } from "./encryption";

interface KlingImageToVideoRequest {
  imageUrl: string;
  prompt: string;
  duration?: "5" | "10";
  modelName?: string;
  mode?: "std" | "pro";
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

interface KlingApiResponse {
  code: number;
  message: string;
  request_id: string;
  data?: {
    task_id?: string;
    task_status?: string;
    task_status_msg?: string;
    task_result?: {
      videos?: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
  };
}

export class KlingService {
  private apiKey: string;
  private baseUrl = "https://api-singapore.klingai.com";

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
      console.log("🎯 Model:", request.modelName || "kling-v1-6");
      console.log("⚡ Mode:", request.mode || "pro");

      const response = await fetch(`${this.baseUrl}/v1/videos/image2video`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_name: request.modelName || "kling-v1-6",
          mode: request.mode || "pro",
          duration: request.duration || "5",
          image: request.imageUrl,
          prompt: request.prompt,
          negative_prompt: request.negativePrompt || "blur, distort, low quality, pixelated, deformed",
          cfg_scale: request.cfgScale ?? 0.5,
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

      const result: KlingApiResponse = await response.json();
      console.log("✅ Kling API response:", JSON.stringify(result, null, 2));

      if (result.code !== 0) {
        return {
          success: false,
          error: result.message || "Unknown Kling API error",
        };
      }

      const taskId = result.data?.task_id;
      if (!taskId) {
        return {
          success: false,
          error: "No task ID returned from Kling API",
        };
      }

      return {
        success: true,
        taskId: taskId,
        status: "pending",
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
      const response = await fetch(`${this.baseUrl}/v1/videos/image2video/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Kling status check error:", response.status, errorText);
        return {
          status: "failed",
          error: `Failed to check status: ${response.status} - ${errorText}`,
        };
      }

      const result: KlingApiResponse = await response.json();
      console.log("📊 Kling task status:", taskId, result.data?.task_status);

      if (result.code !== 0) {
        return {
          status: "failed",
          error: result.message || "Status check failed",
        };
      }

      const taskStatus = result.data?.task_status;
      const videos = result.data?.task_result?.videos;

      if (taskStatus === "succeed" && videos && videos.length > 0) {
        return {
          status: "completed",
          videoUrl: videos[0].url,
        };
      }

      if (taskStatus === "failed") {
        return {
          status: "failed",
          error: result.data?.task_status_msg || "Generation failed",
        };
      }

      const statusMap: Record<string, KlingTaskStatus["status"]> = {
        "submitted": "pending",
        "processing": "processing",
      };

      return {
        status: statusMap[taskStatus || ""] || "processing",
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
    modelName?: string;
    mode?: "std" | "pro";
    waitForCompletion?: boolean;
  }
): Promise<KlingGenerationResult> {
  const service = new KlingService(encryptedApiKey);

  const result = await service.generateImageToVideo({
    imageUrl,
    prompt,
    duration: options?.duration || "5",
    modelName: options?.modelName || "kling-v1-6",
    mode: options?.mode || "pro",
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
