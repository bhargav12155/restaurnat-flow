// Engagement Tracking Library for RestaurantFlow
// Tracks user behavior, generates leads automatically

interface EngagementTracker {
  sessionId: string;
  restaurantSlug: string;
  startTime: number;
  lastHeartbeatTime: number;
  menuItemViews: Map<string, number>;
  interactions: Array<{ type: string; timestamp: number; menuItemId?: string }>;
  isTracking: boolean;
}

class MenuEngagementService {
  private tracker: EngagementTracker | null = null;
  private pageStartTime: number = Date.now();
  private currentMenuItemId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = "") {
    this.apiBaseUrl = apiBaseUrl;
  }

  public initialize(options: { page: string; restaurantSlug: string }): void {
    const { page, restaurantSlug } = options;
    
    if (typeof window === "undefined") return;

    // Get or create session ID
    let sessionId = sessionStorage.getItem("engagement-session-id");
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem("engagement-session-id", sessionId);
    }

    this.tracker = {
      sessionId,
      restaurantSlug,
      startTime: Date.now(),
      lastHeartbeatTime: Date.now(),
      menuItemViews: new Map(),
      interactions: [],
      isTracking: true,
    };

    // Initialize session with backend
    this.trackSession(page);

    // Start heartbeat
    this.startHeartbeat();

    // Setup cleanup listeners
    this.setupPageVisibilityTracking();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async trackSession(page: string): Promise<void> {
    if (!this.tracker) return;

    try {
      await fetch(`${this.apiBaseUrl}/api/track/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          restaurantSlug: this.tracker.restaurantSlug,
          pageVisited: page,
          deviceType: this.getDeviceType(),
        }),
      });
    } catch (error) {
      console.warn("Failed to track session:", error);
    }
  }

  private getDeviceType(): string {
    if (typeof window === "undefined") return "desktop";
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return "tablet";
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return "mobile";
    }
    return "desktop";
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.tracker?.isTracking) {
        this.updateSessionTime();
      }
    }, 30000); // Every 30 seconds
  }

  private async updateSessionTime(): Promise<void> {
    if (!this.tracker) return;

    const now = Date.now();
    const timeDelta = Math.floor((now - this.tracker.lastHeartbeatTime) / 1000);
    
    // Update last heartbeat time
    this.tracker.lastHeartbeatTime = now;

    try {
      await fetch(`${this.apiBaseUrl}/api/track/menu-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          restaurantSlug: this.tracker.restaurantSlug,
          interactionType: "session_heartbeat",
          timeSpentSeconds: timeDelta,
          currentUrl: window.location.pathname,
        }),
      });
    } catch (error) {
      console.warn("Failed to update session time:", error);
    }
  }

  private setupPageVisibilityTracking(): void {
    if (typeof window === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });

    window.addEventListener("beforeunload", () => {
      this.endMenuItemView();
    });
  }

  private pauseTracking(): void {
    if (this.tracker) {
      this.tracker.isTracking = false;
    }
    this.endMenuItemView();
  }

  private resumeTracking(): void {
    if (this.tracker) {
      this.tracker.isTracking = true;
      this.tracker.lastHeartbeatTime = Date.now();
    }
  }

  public async trackMenuItemView(menuItemId: string): Promise<void> {
    if (!this.tracker) return;

    // End previous menu item view
    this.endMenuItemView();

    // Start new menu item view
    this.currentMenuItemId = menuItemId;
    this.pageStartTime = Date.now();

    // Track the view
    const viewCount = (this.tracker.menuItemViews.get(menuItemId) || 0) + 1;
    this.tracker.menuItemViews.set(menuItemId, viewCount);

    this.tracker.interactions.push({
      type: "view",
      timestamp: Date.now(),
      menuItemId,
    });

    try {
      await fetch(`${this.apiBaseUrl}/api/track/menu-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          restaurantSlug: this.tracker.restaurantSlug,
          menuItemId,
          interactionType: "view",
          currentUrl: window.location.pathname,
        }),
      });
    } catch (error) {
      console.warn("Failed to track menu item view:", error);
    }
  }

  private endMenuItemView(): void {
    if (!this.currentMenuItemId || !this.tracker) return;

    const timeSpent = Math.floor((Date.now() - this.pageStartTime) / 1000);

    if (timeSpent > 2) {
      fetch(`${this.apiBaseUrl}/api/track/menu-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          restaurantSlug: this.tracker.restaurantSlug,
          menuItemId: this.currentMenuItemId,
          interactionType: "view_end",
          timeSpentSeconds: timeSpent,
          currentUrl: window.location.pathname,
        }),
      }).catch(() => {});
    }

    this.currentMenuItemId = null;
  }

  public async trackMenuItemLike(menuItemId: string, liked: boolean): Promise<void> {
    if (!this.tracker) return;

    this.tracker.interactions.push({
      type: liked ? "like" : "unlike",
      timestamp: Date.now(),
      menuItemId,
    });

    try {
      await fetch(`${this.apiBaseUrl}/api/track/menu-like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          restaurantSlug: this.tracker.restaurantSlug,
          menuItemId,
          liked,
        }),
      });
    } catch (error) {
      console.warn("Failed to track menu item like:", error);
    }

    // Check if engagement threshold met
    this.checkEngagementLevel();
  }

  public async trackInteraction(
    type: string,
    menuItemId?: string,
    value?: string,
    timeSpentSeconds?: number
  ): Promise<void> {
    if (!this.tracker) return;

    this.tracker.interactions.push({
      type,
      timestamp: Date.now(),
      menuItemId,
    });

    try {
      await fetch(`${this.apiBaseUrl}/api/track/menu-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          restaurantSlug: this.tracker.restaurantSlug,
          menuItemId: menuItemId || null,
          interactionType: type,
          interactionValue: value || null,
          timeSpentSeconds: timeSpentSeconds || 0,
          currentUrl: window.location.pathname,
        }),
      });
    } catch (error) {
      console.warn("Failed to track interaction:", error);
    }
  }

  public async checkEngagementLevel(): Promise<{
    score: number;
    shouldGenerateLead: boolean;
    reason?: string;
  }> {
    if (!this.tracker) {
      return { score: 0, shouldGenerateLead: false };
    }

    let score = 0;
    let reason = "";

    const sessionTime = Math.floor((Date.now() - this.tracker.startTime) / 1000);
    const likeCount = this.tracker.interactions.filter((i) => i.type === "like").length;
    const viewCount = this.tracker.menuItemViews.size;
    const interactionCount = this.tracker.interactions.length;

    // Scoring algorithm
    if (sessionTime > 300) score += 20; // > 5 minutes
    if (viewCount > 3) score += 15; // Viewed multiple menu items
    if (likeCount > 0) score += likeCount * 10; // Liked menu items
    if (interactionCount > 5) score += 10; // High interaction
    if (sessionTime > 600) score += 15; // > 10 minutes

    // Determine reason
    if (likeCount >= 2) {
      reason = "liked_multiple_menu_items";
    } else if (sessionTime > 600) {
      reason = "spent_long_time_on_site";
    } else if (viewCount > 5) {
      reason = "viewed_many_menu_items";
    } else if (interactionCount > 8) {
      reason = "high_interaction_activity";
    }

    const shouldGenerateLead = score >= 25 && reason.length > 0;

    if (shouldGenerateLead) {
      await this.generateEngagementLead();
    }

    return { score, shouldGenerateLead, reason };
  }

  private async generateEngagementLead(): Promise<boolean> {
    if (!this.tracker) return false;

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/track/generate-engagement-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          restaurantSlug: this.tracker.restaurantSlug,
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.warn("Failed to generate engagement lead:", error);
      return false;
    }
  }

  public getEngagementSummary() {
    if (!this.tracker) return null;

    return {
      sessionId: this.tracker.sessionId,
      sessionDuration: Math.floor((Date.now() - this.tracker.startTime) / 1000),
      menuItemsViewed: this.tracker.menuItemViews.size,
      interactions: this.tracker.interactions.length,
    };
  }

  public destroy(): void {
    this.endMenuItemView();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.tracker = null;
  }
}

// Singleton instance
let globalTracker: MenuEngagementService | null = null;

export function initializeEngagementTracking(
  apiBaseUrl?: string
): MenuEngagementService;
export function initializeEngagementTracking(options: {
  page: string;
  restaurantSlug: string;
  apiBaseUrl?: string;
}): MenuEngagementService;
export function initializeEngagementTracking(
  optionsOrUrl?: string | { page: string; restaurantSlug: string; apiBaseUrl?: string }
): MenuEngagementService {
  if (typeof window === "undefined") {
    return new MenuEngagementService("");
  }

  if (!globalTracker) {
    const baseUrl = typeof optionsOrUrl === "string" ? optionsOrUrl : (optionsOrUrl?.apiBaseUrl || "");
    globalTracker = new MenuEngagementService(baseUrl);
  }

  if (typeof optionsOrUrl === "object") {
    globalTracker.initialize({
      page: optionsOrUrl.page,
      restaurantSlug: optionsOrUrl.restaurantSlug,
    });
  }

  return globalTracker;
}

export function getEngagementTracker(): MenuEngagementService | null {
  return globalTracker;
}

export function trackMenuItemView(menuItemId: string): void {
  globalTracker?.trackMenuItemView(menuItemId);
}

export function trackMenuItemLike(menuItemId: string, liked: boolean): void {
  globalTracker?.trackMenuItemLike(menuItemId, liked);
}

export function trackMenuInteraction(
  type: string,
  menuItemId?: string,
  value?: string,
  timeSpentSeconds?: number
): void {
  globalTracker?.trackInteraction(type, menuItemId, value, timeSpentSeconds);
}
