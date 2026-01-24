import { ObjectUploader } from "@/components/ObjectUploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessType } from "@/hooks/useBusinessType";
import { getBusinessLabels } from "@/lib/businessType";
import { friendlyError, messages } from "@/lib/messages";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Brain,
  Calendar,
  CheckCircle,
  CreditCard,
  Eye,
  Facebook,
  Home,
  Image,
  Instagram,
  Linkedin,
  Music,
  Plug,
  PlugZap,
  RefreshCw,
  Settings,
  Sparkles,
  Tag,
  TrendingDown,
  Upload,
  Video,
  Twitter as X,
  Utensils,
  Flame,
  ChefHat,
  Star,
  Clock,
  PartyPopper,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MediaLibrary } from "./media-library";
import { MenuItemSelector, MenuItem } from "./menu-item-selector";
import { PostComposer } from "./post-composer";
import { ComplianceChecker } from "@/components/shared/compliance-checker";

interface SocialMediaAccount {
  id: string;
  platform: string;
  isConnected: boolean;
  lastSync?: string;
}

const platformIcons = {
  facebook: { icon: Facebook, color: "text-blue-600" },
  instagram: { icon: Instagram, color: "text-pink-600" },
  linkedin: { icon: Linkedin, color: "text-blue-700" },
  x: { icon: X, color: "text-black dark:text-white" },
  tiktok: { icon: Music, color: "text-red-500" },
  youtube: { icon: Video, color: "text-red-600" },
};

// Restaurant/Food post types
const postTypes = [
  {
    id: "daily_special",
    label: "Daily Special",
    icon: Star,
    color: "text-yellow-600",
    bgColor: "bg-yellow-600/10",
  },
  {
    id: "new_item",
    label: "New on Menu",
    icon: Utensils,
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
  },
  {
    id: "chef_pick",
    label: "Chef's Pick",
    icon: ChefHat,
    color: "text-purple-600",
    bgColor: "bg-purple-600/10",
  },
  {
    id: "food_photo",
    label: "Food Photo",
    icon: Image,
    color: "text-pink-600",
    bgColor: "bg-pink-600/10",
  },
  {
    id: "limited_time",
    label: "Limited Time",
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-600/10",
  },
  {
    id: "promo",
    label: "Promotion",
    icon: PartyPopper,
    color: "text-green-600",
    bgColor: "bg-green-600/10",
  },
  {
    id: "create_your_own",
    label: "Custom",
    icon: Upload,
    color: "text-indigo-600",
    bgColor: "bg-indigo-600/10",
  },
];

const scheduledPosts = [
  {
    id: 1,
    content: "Today's Special: Chef's signature pasta...",
    date: "Tomorrow 9:00 AM",
    platforms: "FB, IG, LI",
  },
  {
    id: 2,
    content: "New menu item alert! Try our...",
    date: "Friday 2:00 PM",
    platforms: "All platforms",
  },
];

// Stock food photos collection
const stockPhotos = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
    title: "Fresh Salad",
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80",
    title: "Pizza",
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1482049016gy-2d6d-8d1e-8f1?auto=format&fit=crop&w=400&q=80",
    title: "Gourmet Burger",
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&q=80",
    title: "Pancakes",
  },
  {
    id: 5,
    url: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=80",
    title: "Colorful Dish",
  },
  {
    id: 6,
    url: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=400&q=80",
    title: "Pasta Dish",
  },
  {
    id: 7,
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
    title: "Plated Food",
  },
  {
    id: 8,
    url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80",
    title: "BBQ Ribs",
  },
];

export function SocialMediaManager() {
  const { data: businessData, businessType, businessTypeLabel } = useBusinessType();
  const [postContent, setPostContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedPostType, setSelectedPostType] = useState<string | null>(null);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(
    null,
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [facebookPages, setFacebookPages] = useState<any[]>([]);
  const [selectedFacebookPage, setSelectedFacebookPage] = useState<string>("");
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [videoUploadUrl, setVideoUploadUrl] = useState<string | null>(null);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(
    null,
  );
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const { toast } = useToast();

  // Fetch company profile for dynamic content
  const { data: companyProfile } = useQuery<{
    agentName?: string;
    brokerageName?: string;
    businessName?: string;
  }>({
    queryKey: ["/api/company/profile"],
  });

  // Get agent name and brokerage with smart defaults from user profile
  const { user } = useAuth();
  const userFirstName = user?.email?.split('@')[0] || 'Professional';
  const agentName = companyProfile?.agentName || userFirstName;
  const brokerageName = companyProfile?.brokerageName || companyProfile?.businessName || 'Your Company';
  const businessName = companyProfile?.businessName || 'Your Business';

  // OAuth-enabled platforms (only platforms with full OAuth backend support)
  const oauthPlatforms = [
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "x",
    "twitter",
    "tiktok",
  ];

  // Handle OAuth connection
  const handleOAuthConnect = async (platform: string) => {
    let popup: Window | null = null;
    let checkClosedInterval: NodeJS.Timeout | null = null;

    try {
      setConnectingPlatform(platform);

      // Show connecting message
      const connectingMsg = messages.oauth.connecting(platform);
      toast({
        title: connectingMsg.title,
        description: connectingMsg.description,
      });

      // Get OAuth URL from backend
      const response = await fetch(`/api/social/connect/${platform}`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = friendlyError({ status: response.status });
        throw new Error(error.description);
      }

      const data = await response.json();
      const { authUrl } = data;

      // Try to open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popup = window.open(
        authUrl,
        `${platform}_oauth`,
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      // Handle popup blocking with friendly message
      if (!popup || popup.closed) {
        throw new Error("POPUP_BLOCKED");
      }

      // Listen for OAuth callback message
      const messageHandler = (event: MessageEvent) => {
        // Security: Validate origin AND source window
        if (event.origin !== window.location.origin) return;
        if (event.source !== popup) return;

        // Handle success
        if (event.data.success && event.data.platform === platform) {
          // Success! Refresh accounts list
          queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });

          const successMsg = messages.oauth.success(platform);
          toast({
            title: successMsg.title,
            description: successMsg.description,
          });

          cleanup();
        }
        // Handle errors
        else if (event.data.error) {
          const errorMsg = messages.oauth.error(platform, event.data.error);
          toast({
            title: errorMsg.title,
            description: errorMsg.description,
            variant: "destructive",
          });

          cleanup();
        }
      };

      const cleanup = () => {
        if (checkClosedInterval) {
          clearInterval(checkClosedInterval);
          checkClosedInterval = null;
        }
        window.removeEventListener("message", messageHandler);
        setConnectingPlatform(null);
      };

      window.addEventListener("message", messageHandler);

      // Also check if popup was closed without success
      checkClosedInterval = setInterval(() => {
        if (popup && popup.closed) {
          const cancelledMsg = messages.oauth.cancelled(platform);
          toast({
            title: cancelledMsg.title,
            description: cancelledMsg.description,
          });
          cleanup();
        }
      }, 500);
    } catch (error: any) {
      console.error("OAuth connection error:", error);

      // Handle popup blocking specifically
      if (error.message === "POPUP_BLOCKED") {
        toast({
          title: "Pop-ups are blocked",
          description: `To connect your ${platform} account, please allow pop-ups for this site in your browser settings. On mobile, try using the browser's desktop mode.`,
          variant: "destructive",
        });
      } else {
        // Use friendlyError to provide context-aware messages (network, auth, etc.)
        const friendlyMsg = friendlyError(error);
        const errorMsg = messages.oauth.error(
          platform,
          friendlyMsg.description,
        );
        toast({
          title: errorMsg.title,
          description: errorMsg.description,
          variant: "destructive",
        });
      }

      setConnectingPlatform(null);

      if (checkClosedInterval) {
        clearInterval(checkClosedInterval);
      }
    }
  };

  const {
    data: accounts,
    isLoading,
    error,
  } = useQuery<SocialMediaAccount[]>({
    queryKey: ["/api/social/accounts"],
  });

  // Debug: Log accounts when they change
  useEffect(() => {
    console.log("🔍 Social accounts data:", accounts);
    console.log("🔍 Is loading:", isLoading);
    console.log("🔍 Error:", error);
    console.log("🔍 Document cookies:", document.cookie);
  }, [accounts, isLoading, error]);

  // Handle disconnect
  const disconnectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const response = await apiRequest(
        "POST",
        `/api/social/disconnect/${platform}`,
        {},
      );
      return response.json();
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
      const successMsg = messages.oauth.disconnectSuccess(platform);
      toast({
        title: successMsg.title,
        description: successMsg.description,
      });
    },
    onError: (error: Error, platform) => {
      const errorMsg = messages.oauth.disconnectError(platform);
      toast({
        title: errorMsg.title,
        description: errorMsg.description,
        variant: "destructive",
      });
    },
  });

  // Load Facebook pages when component mounts or when Facebook connection status changes
  useEffect(() => {
    const facebookAccount = accounts?.find(
      (a) => a.platform === "facebook" || a.platform === "facebook_page"
    );
    
    const loadFacebookPages = async () => {
      if (!facebookAccount?.isConnected) {
        setFacebookPages([]);
        return;
      }
      
      try {
        const response = await fetch("/api/facebook/pages");
        if (response.ok) {
          const pages = await response.json();
          setFacebookPages(pages);
          
          // Restore saved page from localStorage or auto-select first page
          const savedPageId = localStorage.getItem("selectedFacebookPage");
          if (savedPageId && pages.some((p: any) => p.id === savedPageId)) {
            setSelectedFacebookPage(savedPageId);
          } else if (pages.length > 0 && !selectedFacebookPage) {
            setSelectedFacebookPage(pages[0].id);
            localStorage.setItem("selectedFacebookPage", pages[0].id);
          }
        }
      } catch (error) {
        console.log("No Facebook pages available");
      }
    };
    loadFacebookPages();
  }, [accounts]);
  
  // Persist selected Facebook page to localStorage
  useEffect(() => {
    if (selectedFacebookPage) {
      localStorage.setItem("selectedFacebookPage", selectedFacebookPage);
    }
  }, [selectedFacebookPage]);

  // Handle YouTube posting with on-demand authentication
  const handleYouTubePost = async (content: string, videoFile?: File) => {
    try {
      // Check if we have a stored YouTube access token
      const youtubeAccount = accounts?.find(
        (account) => account.platform === "youtube",
      );

      if (!youtubeAccount || !youtubeAccount.isConnected) {
        // No YouTube account connected - start OAuth flow
        toast({
          title: "YouTube Authentication Required",
          description:
            "Redirecting to Google to connect your YouTube account...",
        });

        // Store the content we want to post after authentication
        sessionStorage.setItem("pendingYouTubePost", content);
        if (videoFile) {
          // For video files, we'd need to handle them differently in storage
          // For now, we'll show a message about re-uploading
          toast({
            title: "Video Upload Notice",
            description:
              "Please re-upload your video after YouTube authentication.",
            variant: "default",
          });
        }

        // Redirect to YouTube OAuth
        window.location.href = "/auth/youtube";
        return { success: false, message: "Redirecting to authentication..." };
      }

      // We have authentication - proceed with posting
      if (videoFile) {
        // Upload video file to YouTube
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("title", content.substring(0, 100));
        formData.append("description", content);

        const response = await fetch("/api/youtube/upload-video", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to upload video to YouTube",
          );
        }

        return response.json();
      } else {
        // Regular content posting (community post attempt)
        const response = await apiRequest("POST", "/api/youtube/post", {
          content: content,
          title: content.substring(0, 100) + "...",
          description: content,
          accessToken: (youtubeAccount as any).accessToken,
        });

        return response.json();
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to post to YouTube");
    }
  };

  // Check for pending YouTube posts after OAuth callback
  useEffect(() => {
    const pendingPost = sessionStorage.getItem("pendingYouTubePost");
    if (pendingPost) {
      // Clear the pending post
      sessionStorage.removeItem("pendingYouTubePost");

      // Set the content and show user the post is ready
      setPostContent(pendingPost);
      setSelectedPlatforms(["youtube"]);

      toast({
        title: "YouTube Connected!",
        description:
          "Your content is ready to post. Click 'Post' to publish to YouTube.",
      });
    }
  }, [accounts]);

  const postMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      platforms: string[];
      mediaIds?: string[];
    }) => {
      // Check if YouTube is selected and handle on-demand authentication
      if (data.platforms.includes("youtube")) {
        return await handleYouTubePost(
          data.content,
          uploadedVideo || undefined,
        );
      }

      // Handle other platform-specific posting
      if (data.platforms.includes("facebook")) {
        // Check if a Facebook Page is selected
        if (!selectedFacebookPage) {
          throw new Error("Please select a Facebook Page before posting");
        }

        // Use Facebook Pages API for Facebook posting
        const facebookResponse = await apiRequest(
          "POST",
          "/api/facebook/post",
          {
            content: data.content,
            pageId: selectedFacebookPage,
            mediaIds: data.mediaIds || [],
          },
        );
        return facebookResponse.json();
      } else if (data.platforms.includes("instagram")) {
        // Use Instagram Graph API for Instagram posting
        const instagramResponse = await apiRequest(
          "POST",
          "/api/instagram/post",
          {
            content: data.content,
            mediaIds: data.mediaIds || [],
            // Instagram User ID will be read from environment variables
          },
        );
        return instagramResponse.json();
      } else if (
        data.platforms.includes("x") ||
        data.platforms.includes("twitter")
      ) {
        // Use Twitter API for Twitter posting - must use FormData for multer
        const formData = new FormData();
        formData.append("content", data.content);

        // Add mediaIds if present
        if (data.mediaIds && data.mediaIds.length > 0) {
          formData.append("mediaIds", JSON.stringify(data.mediaIds));
        }

        const response = await fetch("/api/twitter/post", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to post to Twitter");
        }

        return response.json();
      } else {
        // For other platforms, use the general endpoint
        const response = await apiRequest("POST", "/api/social/post", {
          ...data,
          mediaIds: data.mediaIds || [],
        });
        return response.json();
      }
    },
    onSuccess: () => {
      // Refresh accounts to ensure connection status is up-to-date
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });

      toast({
        title: "Posted Successfully!",
        description: "Your content has been shared across selected platforms",
      });
      setPostContent("");
      setSelectedMediaIds([]);
    },
    onError: (error: any) => {
      toast({
        title: "Posting Failed",
        description: error.message || "Failed to post to social media",
        variant: "destructive",
      });
    },
  });

  const facebookPostMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      pageId?: string;
      photo?: File;
    }) => {
      const formData = new FormData();
      formData.append("content", data.content);

      if (data.photo) {
        formData.append("photo", data.photo);
      }

      if (data.pageId) {
        formData.append("pageId", data.pageId);
      }

      const response = await fetch("/api/facebook/post", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to post to Facebook");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Refresh accounts to ensure connection status is up-to-date
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });

      toast({
        title: "Facebook Post Successful!",
        description:
          data.message ||
          "Your content has been posted to Facebook successfully.",
      });
      setPostContent("");
      setSelectedMenuItem(null);
      setSelectedPostType(null);
      setSelectedFacebookPage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Facebook Post Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const optimizeContentMutation = useMutation({
    mutationFn: async (data: { topic: string; platform: string }) => {
      const response = await apiRequest(
        "POST",
        "/api/content/social-post",
        data,
      );
      return response.json();
    },
    onSuccess: (data) => {
      setPostContent(
        data.content +
          (data.hashtags
            ? " " + data.hashtags.map((tag: string) => "#" + tag).join(" ")
            : ""),
      );
      toast({
        title: "Content Optimized!",
        description:
          "Generated platform-specific content for better engagement",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Optimization Failed",
        description: error.message || "Failed to optimize content",
        variant: "destructive",
      });
    },
  });

  // Generate content for menu items (restaurant promotional posts)
  const generateMenuItemContent = (
    item: MenuItem,
    postType: string,
    platform: string,
  ) => {
    const formatPrice = (price: string | number) => {
      const num = typeof price === "string" ? parseFloat(price) : price;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(num);
    };

    const dietaryEmojis = item.dietaryTags?.map(tag => {
      const emojiMap: Record<string, string> = {
        'vegetarian': '🥬',
        'vegan': '🌱',
        'gluten-free': '🌾',
        'halal': '☪️',
        'kosher': '✡️',
        'dairy-free': '🥛',
        'nut-free': '🥜',
        'low-carb': '🥩',
        'keto': '🥑',
      };
      return emojiMap[tag] || '';
    }).filter(Boolean).join(' ') || '';

    const spiceEmoji = item.spiceLevel && item.spiceLevel > 0 
      ? '🌶️'.repeat(Math.min(item.spiceLevel, 5)) 
      : '';

    const templates = {
      daily_special: {
        facebook: `⭐ TODAY'S SPECIAL! ⭐

${item.name}
${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}${item.isSpecial ? ` (was ${formatPrice(item.price)})` : ''}

${item.description || ''}

${dietaryEmojis ? `🏷️ ${dietaryEmojis}` : ''}
${item.preparationTime ? `⏱️ Ready in ${item.preparationTime} min` : ''}
${item.calories ? `🔥 ${item.calories} cal` : ''}

Come taste what everyone's talking about! Available today only.

📍 ${businessName}

#DailySpecial #FoodLovers #${businessName.replace(/\s+/g, '')} #Foodie #TodayOnly`,

        instagram: `⭐ TODAY'S SPECIAL ⭐

${item.name}
${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}

${item.description?.substring(0, 120) || ''}...

${dietaryEmojis} ${spiceEmoji}

Available TODAY only! 🏃‍♂️

#DailySpecial #Foodie #${businessName.replace(/\s+/g, '')} #FoodPhotography`,

        x: `⭐ TODAY'S SPECIAL!\n\n${item.name}\n${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}\n\n${item.description?.substring(0, 80) || ''}\n\n${dietaryEmojis}\n\n📍 ${businessName}\n\n#DailySpecial #Foodie`,

        youtube: `⭐ TODAY'S SPECIAL: ${item.name}

Check out what our chef has prepared for today's special! This ${item.name} is available for a limited time at ${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}.

${item.description || ''}

${item.ingredients?.length ? `Made with: ${item.ingredients.join(', ')}` : ''}

${businessName}
#DailySpecial #FoodLovers #ChefSpecial`,
      },

      new_item: {
        facebook: `🆕 NEW ON THE MENU! 🆕

Introducing: ${item.name}
${formatPrice(item.price)}

${item.description || ''}

${dietaryEmojis ? `Perfect for: ${dietaryEmojis}` : ''}
${item.ingredients?.length ? `\nMade with: ${item.ingredients.slice(0, 5).join(', ')}` : ''}

Be one of the first to try our newest creation! 

📍 ${businessName}

#NewOnMenu #FoodLaunch #${businessName.replace(/\s+/g, '')} #Foodie #MustTry`,

        instagram: `🆕 NEW MENU ITEM ALERT!

${item.name}
${formatPrice(item.price)}

${item.description?.substring(0, 100) || ''}

${dietaryEmojis} ${spiceEmoji}

Tag someone who needs to try this! 👇

#NewOnMenu #Foodie #${businessName.replace(/\s+/g, '')} #FoodPhotography`,

        x: `🆕 NEW ON THE MENU!\n\n${item.name} - ${formatPrice(item.price)}\n\n${item.description?.substring(0, 80) || ''}\n\n${dietaryEmojis}\n\n#NewOnMenu #Foodie`,

        youtube: `🆕 NEW MENU ITEM: ${item.name}

We're excited to introduce our newest addition to the menu! ${item.name} is now available for ${formatPrice(item.price)}.

${item.description || ''}

Come try it today at ${businessName}!
#NewOnMenu #FoodLaunch #MustTry`,
      },

      chef_pick: {
        facebook: `👨‍🍳 CHEF'S RECOMMENDATION 👨‍🍳

${item.name}
${formatPrice(item.price)}

Our chef's personal favorite and a must-try for food lovers!

${item.description || ''}

${dietaryEmojis ? `🏷️ ${dietaryEmojis}` : ''}
${item.preparationTime ? `⏱️ ${item.preparationTime} min to perfection` : ''}

Experience culinary excellence at ${businessName}!

#ChefsPick #GourmetFood #${businessName.replace(/\s+/g, '')} #Foodie #ChefRecommends`,

        instagram: `👨‍🍳 CHEF'S PICK 👨‍🍳

${item.name}
${formatPrice(item.price)}

${item.description?.substring(0, 100) || ''}

Our chef's personal favorite! ⭐

${dietaryEmojis} ${spiceEmoji}

#ChefsPick #Foodie #${businessName.replace(/\s+/g, '')} #GourmetFood`,

        x: `👨‍🍳 CHEF'S PICK!\n\n${item.name} - ${formatPrice(item.price)}\n\n${item.description?.substring(0, 80) || ''}\n\nMust try! 🌟\n\n#ChefsPick #Foodie`,

        youtube: `👨‍🍳 CHEF'S RECOMMENDATION: ${item.name}

Our head chef personally recommends this dish! ${item.name} at ${formatPrice(item.price)} is a true culinary masterpiece.

${item.description || ''}

${businessName}
#ChefsPick #GourmetFood #Recommended`,
      },

      food_photo: {
        facebook: `📸 Looking delicious, isn't it?

${item.name}
${formatPrice(item.price)}

${item.description || ''}

Tag someone who would love this! 👇

📍 ${businessName}

#FoodPhotography #Foodie #${businessName.replace(/\s+/g, '')} #Delicious`,

        instagram: `📸 Food that looks as good as it tastes!

${item.name}
${formatPrice(item.price)}

${dietaryEmojis} ${spiceEmoji}

Double tap if you're hungry! ❤️

#FoodPhotography #Foodie #FoodPorn #${businessName.replace(/\s+/g, '')}`,

        x: `📸 ${item.name}\n${formatPrice(item.price)}\n\nLooks delicious, right? 😋\n\n📍 ${businessName}\n\n#FoodPhotography #Foodie`,

        youtube: `📸 ${item.name} | Food Photography

Sometimes a dish is too beautiful not to share. This is our ${item.name} at ${formatPrice(item.price)}.

${item.description || ''}

${businessName}
#FoodPhotography #Delicious`,
      },

      limited_time: {
        facebook: `⏰ LIMITED TIME OFFER! ⏰

${item.name}
${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}${item.isSpecial ? ` (Regular ${formatPrice(item.price)})` : ''}

Don't miss out on this special offering!

${item.description || ''}

${item.specialEndDate ? `Available until ${new Date(item.specialEndDate).toLocaleDateString()}` : 'While supplies last!'}

📍 ${businessName}

#LimitedTime #SpecialOffer #${businessName.replace(/\s+/g, '')} #DontMissOut`,

        instagram: `⏰ LIMITED TIME ONLY!

${item.name}
${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}

${item.description?.substring(0, 100) || ''}

Get it before it's gone! 🏃‍♂️💨

#LimitedTime #SpecialOffer #Foodie #${businessName.replace(/\s+/g, '')}`,

        x: `⏰ LIMITED TIME!\n\n${item.name}\n${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}\n\nDon't miss out! 🏃‍♂️\n\n#LimitedTime #SpecialOffer`,

        youtube: `⏰ LIMITED TIME: ${item.name}

This special offering won't be around forever! Try our ${item.name} for ${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)} while you can.

${item.description || ''}

${businessName}
#LimitedTime #SpecialOffer #GetItNow`,
      },

      promo: {
        facebook: `🎉 SPECIAL PROMOTION! 🎉

${item.name}
NOW ${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}${item.isSpecial ? ` (Save from ${formatPrice(item.price)}!)` : ''}

${item.description || ''}

Share with friends and family! 

📍 ${businessName}

#Promotion #SpecialDeal #${businessName.replace(/\s+/g, '')} #FoodDeals`,

        instagram: `🎉 PROMO TIME! 🎉

${item.name}
${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)} 🔥

${item.description?.substring(0, 100) || ''}

Tag someone who needs to know! 👇

#Promotion #FoodDeals #${businessName.replace(/\s+/g, '')} #Savings`,

        x: `🎉 PROMO ALERT!\n\n${item.name}\n${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}\n\n📍 ${businessName}\n\n#Promotion #FoodDeals`,

        youtube: `🎉 SPECIAL PROMOTION: ${item.name}

We're celebrating with a special deal! Get our ${item.name} for ${formatPrice(item.isSpecial && item.specialPrice ? item.specialPrice : item.price)}.

${item.description || ''}

Visit ${businessName} today!
#Promotion #SpecialDeal #FoodLovers`,
      },
    };

    const postTypeTemplates = templates[postType as keyof typeof templates];
    if (postTypeTemplates && platform in postTypeTemplates) {
      return postTypeTemplates[platform as keyof typeof postTypeTemplates];
    }

    return `Try our delicious ${item.name}! ${formatPrice(item.price)} | ${businessName}`;
  };

  const handlePost = () => {
    let content = postContent.trim();

    // If menu item is selected and no custom content, generate menu item content
    if (selectedMenuItem && !postContent.trim() && selectedPostType) {
      const primaryPlatform = selectedPlatforms[0] || "facebook";
      content = generateMenuItemContent(
        selectedMenuItem,
        selectedPostType,
        primaryPlatform,
      );
    }

    if (!content) {
      toast({
        title: "Content Required",
        description:
          "Please enter content to post or select a menu item with post type",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select Platforms",
        description: "Please select at least one platform to post to",
        variant: "destructive",
      });
      return;
    }

    postMutation.mutate({
      content,
      platforms: selectedPlatforms,
      mediaIds: selectedMediaIds,
    });
  };

  const handlePlatformToggle = (platform: string, isConnected: boolean) => {
    if (!isConnected) return;

    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  const handleOptimizeContent = () => {
    if (!postContent.trim()) {
      toast({
        title: "Content Required",
        description: "Please enter some content to optimize",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select Platform",
        description: "Please select at least one platform to optimize for",
        variant: "destructive",
      });
      return;
    }

    // Optimize for the first selected platform with post type context
    const primaryPlatform = selectedPlatforms[0];
    const topic = selectedPostType
      ? `${selectedPostType.replace("_", " ")} ${postContent.trim()}`.trim()
      : postContent.trim();

    optimizeContentMutation.mutate({
      topic,
      platform: primaryPlatform,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Quick Posts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Select Platforms
            </h3>
          </div>
          {accounts?.map((account) => {
            // Normalize platform name (handle aliases like twitter->x, facebook_page->facebook)
            const normalizedPlatform = account.platform
              .toLowerCase()
              .replace("twitter", "x")
              .replace("facebook_page", "facebook")
              .replace("_", "");
            const platformInfo = platformIcons[
              normalizedPlatform as keyof typeof platformIcons
            ] || { icon: Settings, color: "text-gray-600" }; // Fallback for unknown platforms

            const PlatformIcon = platformInfo.icon;

            return (
              <div key={account.id}>
                <div
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedPlatforms.includes(account.platform)}
                      onCheckedChange={(checked) =>
                        handlePlatformToggle(
                          account.platform,
                          account.isConnected,
                        )
                      }
                      disabled={!account.isConnected}
                      className="h-5 w-5 bg-[#2d4450] text-[#304652]"
                      data-testid={`checkbox-${account.platform}`}
                    />
                    <PlatformIcon className={`h-4 w-4 ${platformInfo.color}`} />
                    <span className="text-sm font-medium capitalize">
                      {account.platform}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid={`status-${account.platform}`}
                    title={account.isConnected ? "Connected" : "Disconnected"}
                  >
                    {account.isConnected ? (
                      <>
                        <Plug className="h-5 w-5 text-green-600" />
                        <Button
                          onClick={() =>
                            disconnectMutation.mutate(
                              account.platform.toLowerCase(),
                            )
                          }
                          disabled={disconnectMutation.isPending}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                          data-testid={`button-disconnect-${account.platform}`}
                        >
                          {disconnectMutation.isPending ? (
                            <>
                              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            <>
                              <PlugZap className="mr-1 h-3 w-3" />
                              Disconnect
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <PlugZap className="h-5 w-5 text-red-600" />
                        {oauthPlatforms.includes(
                          account.platform.toLowerCase(),
                        ) && (
                          <Button
                            onClick={() =>
                              handleOAuthConnect(account.platform.toLowerCase())
                            }
                            disabled={
                              connectingPlatform ===
                              account.platform.toLowerCase()
                            }
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300"
                            data-testid={`button-connect-${account.platform}`}
                          >
                            {connectingPlatform ===
                            account.platform.toLowerCase() ? (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Plug className="mr-1 h-3 w-3" />
                                Reconnect
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!account.isConnected && (account.platform === "facebook" || account.platform === "facebook_page" || account.platform === "instagram") && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md w-full">
                    <p className="text-xs text-blue-900 dark:text-blue-100">
                      <strong>Note:</strong> {account.platform === "instagram" ? "Instagram" : "Facebook"} posts require a{" "}
                      {account.platform === "instagram" ? "Business or Creator Account" : "Page"}. Posts will not appear on your personal profile. Please make sure you have a{" "}
                      {account.platform === "instagram" ? "Business/Creator Account" : "Page"} created before connecting.
                    </p>
                  </div>
                )}
                {/* Facebook Page Selector - Show immediately when Facebook is connected */}
                {account.isConnected && (account.platform === "facebook" || account.platform === "facebook_page") && (
                  <div className="mt-2 ml-8 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 space-y-2">
                    <Label
                      htmlFor="facebook-page-inline-select"
                      className="text-xs font-medium text-blue-900 dark:text-blue-100"
                    >
                      Select Facebook Page to post to:
                    </Label>
                    {facebookPages.length > 0 ? (
                      <>
                        <select
                          id="facebook-page-inline-select"
                          value={selectedFacebookPage}
                          onChange={(e) => setSelectedFacebookPage(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-blue-300 bg-white dark:bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          data-testid="select-facebook-page-inline"
                        >
                          <option value="">Select a page...</option>
                          {facebookPages.map((page: any) => (
                            <option key={page.id} value={page.id}>
                              {page.name}
                            </option>
                          ))}
                        </select>
                        {selectedFacebookPage && (
                          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Ready to post to: {facebookPages.find((p: any) => p.id === selectedFacebookPage)?.name}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Loading your Pages...</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* YouTube Video Upload Option */}
        {selectedPlatforms.includes("youtube") && (
          <div className="space-y-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-medium text-foreground">
                YouTube Video Upload
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a video file to post directly to your YouTube channel as a
              public video.
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowVideoUpload(true)}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                data-testid="button-upload-video"
              >
                <Upload className="mr-2 h-3 w-3" />
                {uploadedVideo ? "Change Video" : "Upload Video"}
              </Button>
              {uploadedVideo && (
                <>
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Video ready: {uploadedVideo.name}
                  </div>
                  <Button
                    onClick={() => {
                      const videoTitle = postContent.trim() || `${businessTypeLabel} Video Update`;
                      const videoDescription = postContent.trim() || `Check out what's new at our ${(businessTypeLabel || 'restaurant').toLowerCase()}!`;
                      
                      postMutation.mutate({
                        content: videoTitle.substring(0, 100),
                        platforms: ["youtube"],
                        mediaIds: [],
                      });
                    }}
                    disabled={postMutation.isPending}
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700"
                    data-testid="button-post-youtube-video"
                  >
                    {postMutation.isPending ? "Uploading..." : "Post Video"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Quick Post */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Quick Post</h3>
          </div>

          {/* Item Selector */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Select Item (Optional)
            </div>
            <MenuItemSelector
              onSelectMenuItem={setSelectedMenuItem}
              selectedMenuItem={selectedMenuItem}
              showQuickAdd={true}
            />
          </div>

          {/* Post Type Selection */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Post Type (Optional)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {postTypes.map((type) => (
                <Button
                  key={type.id}
                  variant={selectedPostType === type.id ? "default" : "outline"}
                  size="sm"
                  className={`text-[10px] h-10 justify-start gap-3 border-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedPostType === type.id
                      ? `${type.bgColor} ${type.color} border-current shadow-md`
                      : "border-golden-muted/30 hover:border-golden-accent/50 hover:bg-golden-accent/5 hover:shadow-sm"
                  }`}
                  onClick={() => {
                    const newType =
                      selectedPostType === type.id ? null : type.id;
                    setSelectedPostType(newType);

                    // Auto-generate content if menu item is selected
                    if (
                      selectedMenuItem &&
                      newType &&
                      selectedPlatforms.length > 0 &&
                      type.id !== "create_your_own"
                    ) {
                      const primaryPlatform = selectedPlatforms[0];
                      const generatedContent = generateMenuItemContent(
                        selectedMenuItem,
                        newType,
                        primaryPlatform,
                      );
                      setPostContent(generatedContent);
                    }
                  }}
                  data-testid={`post-type-${type.id}`}
                >
                  <div className="p-1.5 rounded-md bg-[#2d4450]">
                    <type.icon
                      className={`h-3.5 w-3.5 ${
                        selectedPostType === type.id
                          ? type.color
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Facebook Page Selector - Highlighted Card */}
          {selectedPlatforms.includes("facebook") &&
            facebookPages.length > 0 && (
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Facebook className="h-5 w-5 text-blue-600" />
                  <Label
                    htmlFor="facebook-page-select"
                    className="text-sm font-semibold text-blue-900 dark:text-blue-100"
                  >
                    Select Your Facebook Page
                  </Label>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Choose which Facebook Page you want to post to
                </p>
                <select
                  id="facebook-page-select"
                  value={selectedFacebookPage}
                  onChange={(e) => setSelectedFacebookPage(e.target.value)}
                  className="flex h-10 w-full rounded-md border-2 border-blue-300 bg-white dark:bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  data-testid="select-facebook-page"
                >
                  <option value="">Select a Facebook Page to post to...</option>
                  {facebookPages.map((page: any) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
                {!selectedFacebookPage && (
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <span>⚠️</span> Please select a Facebook Page before posting
                  </p>
                )}
                {selectedFacebookPage && (
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <span>✓</span> Ready to post to: {facebookPages.find((p: any) => p.id === selectedFacebookPage)?.name}
                  </p>
                )}
              </div>
            )}

          {/* Media Library */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Media Library
                </span>
                {selectedMediaIds.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    {selectedMediaIds.length} selected
                  </span>
                )}
              </div>
              {selectedMediaIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMediaIds([])}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </Button>
              )}
            </div>
            <div className="relative rounded-lg border border-border bg-gradient-to-br from-muted/20 to-muted/5 p-4 max-h-[400px] overflow-y-auto overflow-x-hidden w-full">
              <MediaLibrary
                onSelectMedia={setSelectedMediaIds}
                selectedMediaIds={selectedMediaIds}
                multiSelect={true}
                typeFilter="all"
              />
            </div>
            
            {/* Helper text below the container */}
            {selectedMediaIds.length === 0 && (
              <p className="text-xs text-muted-foreground/70 text-center -mt-1">
                Click media items to attach them to your post
              </p>
            )}
          </div>

          <Textarea
            placeholder={
              selectedPostType
                ? `Enter details for ${postTypes
                    .find((t) => t.id === selectedPostType)
                    ?.label.toLowerCase()} post (dish name, ingredients, special offers, etc.)...`
                : "Share what's cooking, menu highlights, or select a post type above and click AI Optimize..."
            }
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-social-post"
          />

          {/* Optional AI Prompt Enhancement */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Brain className="h-3 w-3" />
                AI Prompt (Optional)
              </label>
            </div>
            <Input
              placeholder="Add specific instructions for AI enhancement (e.g., 'Make it more engaging', 'Add call-to-action', 'Include market stats')..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="text-sm"
              data-testid="input-ai-prompt"
            />
            <p className="text-xs text-muted-foreground">
              💡 Use this to guide AI optimization with specific instructions or
              tone preferences
            </p>
          </div>

          {selectedPlatforms.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Posting to:{" "}
              {selectedPlatforms
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(", ")}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    disabled={!postContent.trim()}
                    data-testid="button-preview-post"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Post Preview</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Posting to:{" "}
                      {selectedPlatforms.length > 0
                        ? selectedPlatforms
                            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                            .join(", ")
                        : "No platforms selected"}
                    </div>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-golden-accent rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-golden-foreground">
                            {businessName.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-foreground">
                            {businessName}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {brokerageName}
                          </div>
                          <div className="text-sm text-foreground whitespace-pre-wrap">
                            {postContent}
                          </div>
                          {selectedMenuItem && (
                            <div className="mt-3 p-3 bg-background rounded-md border">
                              <div className="font-medium text-sm flex items-center gap-2">
                                {selectedMenuItem.name}
                                {selectedMenuItem.isFeatured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                {selectedMenuItem.isChefRecommended && <ChefHat className="h-3 w-3 text-purple-500" />}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {selectedMenuItem.description}
                              </div>
                              <div className="text-sm font-medium mt-1">
                                ${parseFloat(selectedMenuItem.price).toFixed(2)}
                                {selectedMenuItem.isSpecial && selectedMenuItem.specialPrice && (
                                  <span className="ml-2 text-xs line-through text-muted-foreground">
                                    ${parseFloat(selectedMenuItem.specialPrice).toFixed(2)}
                                  </span>
                                )}
                              </div>
                              {selectedMenuItem.dietaryTags && selectedMenuItem.dietaryTags.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {selectedMenuItem.dietaryTags.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-schedule"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleOptimizeContent}
                      disabled={
                        optimizeContentMutation.isPending || !postContent.trim()
                      }
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80"
                      data-testid="button-optimize-content"
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      {optimizeContentMutation.isPending
                        ? "Optimizing..."
                        : "AI Optimize"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>AI Optimize enhances your post content with better engagement and professional messaging. It analyzes your text and suggests improvements for clarity, tone, and marketing best practices to help get more visibility and responses from your audience.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                onClick={handlePost}
                disabled={
                  postMutation.isPending || selectedPlatforms.length === 0
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-post-now"
              >
                {postMutation.isPending ? "Posting..." : "Post Now"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Video Upload Dialog for YouTube */}
      <Dialog open={showVideoUpload} onOpenChange={setShowVideoUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Video for YouTube</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a video to post to your YouTube channel. This will create a
              public video on your channel.
            </p>

            {uploadedVideo ? (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted">
                  <div className="flex items-center gap-3">
                    <Video className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {uploadedVideo.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedVideo.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-600 font-medium">
                    Video ready for upload!
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedVideo(null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check file size (HeyGen max is 200MB)
                      if (file.size > 200 * 1024 * 1024) {
                        toast({
                          title: "File Too Large",
                          description:
                            "Please select a video smaller than 200MB",
                          variant: "destructive",
                        });
                        return;
                      }
                      setUploadedVideo(file);
                      toast({
                        title: "Video Selected",
                        description: "Your video is ready to upload to YouTube",
                      });
                    }
                  }}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">
                  Supported formats: MP4, MOV, WEBM, MKV (max 200MB)
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowVideoUpload(false);
                  setUploadedVideo(null);
                }}
              >
                Cancel
              </Button>
              {uploadedVideo && (
                <Button
                  className="flex-1"
                  onClick={() => setShowVideoUpload(false)}
                >
                  Use This Video
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Composer */}
      <PostComposer
        open={showPostComposer}
        onOpenChange={setShowPostComposer}
      />
    </Card>
  );
}
