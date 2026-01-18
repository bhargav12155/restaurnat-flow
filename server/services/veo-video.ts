import { GoogleGenAI } from "@google/genai";

interface VeoVideoRequest {
  imageUrl: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  duration?: 4 | 6 | 8;
}

interface VeoVideoResult {
  success: boolean;
  videoUrl?: string;
  operationId?: string;
  error?: string;
}

interface VeoOperationStatus {
  done: boolean;
  videoUrl?: string;
  error?: string;
}

export class VeoVideoService {
  private client: GoogleGenAI | null = null;
  private pendingOperations: Map<string, any> = new Map();

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      console.log("✅ [VeoVideo] Initialized with Gemini API key");
    } else {
      console.warn("⚠️ [VeoVideo] No GEMINI_API_KEY found - video generation disabled");
    }
  }

  async generateVideo(request: VeoVideoRequest): Promise<VeoVideoResult> {
    if (!this.client) {
      return { success: false, error: "Gemini API key not configured" };
    }

    try {
      console.log(`🎬 [VeoVideo] Starting video generation from image`);
      console.log(`📝 [VeoVideo] Prompt: ${request.prompt.substring(0, 100)}...`);

      const imageData = await this.fetchImageAsBase64(request.imageUrl);
      if (!imageData) {
        return { success: false, error: "Failed to fetch image" };
      }

      const operation = await this.client.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: request.prompt,
        image: {
          imageBytes: imageData.bytes,
          mimeType: imageData.mimeType,
        },
        config: {
          aspectRatio: request.aspectRatio || "16:9",
          numberOfVideos: 1,
        },
      });

      const operationId = `veo-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      this.pendingOperations.set(operationId, operation);

      console.log(`✅ [VeoVideo] Operation started: ${operationId}`);

      return {
        success: true,
        operationId,
      };
    } catch (error: any) {
      console.error("❌ [VeoVideo] Generation error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async checkOperationStatus(operationId: string): Promise<VeoOperationStatus> {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return { done: false, error: "Operation not found" };
    }

    try {
      if (!this.client) {
        return { done: false, error: "Client not initialized" };
      }

      const updatedOperation = await this.client.operations.getVideosOperation({
        operation: operation,
      });
      
      if (updatedOperation.done) {
        this.pendingOperations.delete(operationId);

        const response = updatedOperation.response as any;
        const generatedVideos = response?.generatedVideos || response?.generated_videos;
        if (generatedVideos && generatedVideos.length > 0) {
          const video = generatedVideos[0].video;
          
          if (video) {
            const fs = await import("fs");
            const path = await import("path");
            
            const outputDir = "/tmp/veo-output";
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const filename = `property-tour-${operationId}.mp4`;
            const filepath = path.join(outputDir, filename);
            
            await this.client.files.download({ file: video, downloadPath: filepath });
            
            console.log(`✅ [VeoVideo] Video completed: ${filepath}`);
            return { done: true, videoUrl: `/api/property-tour/veo-video/${filename}` };
          }
        }
        
        return { done: true, error: "No video in response" };
      }

      this.pendingOperations.set(operationId, updatedOperation);

      return { done: false };
    } catch (error: any) {
      console.error("❌ [VeoVideo] Status check error:", error.message);
      return { done: false, error: error.message };
    }
  }

  async waitForCompletion(operationId: string, maxWaitMs: number = 180000): Promise<VeoOperationStatus> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkOperationStatus(operationId);
      
      if (status.done) {
        return status;
      }
      
      if (status.error && !status.error.includes("not found")) {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    return { done: false, error: "Video generation timed out" };
  }

  private async fetchImageAsBase64(url: string): Promise<{ bytes: string; mimeType: string } | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`❌ [VeoVideo] Failed to fetch image: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return { bytes: base64, mimeType: contentType };
    } catch (error: any) {
      console.error(`❌ [VeoVideo] Image fetch error:`, error.message);
      return null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}

export const veoVideoService = new VeoVideoService();
