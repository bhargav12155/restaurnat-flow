import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter as X,
  Globe,
  Key,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CompanyProfile } from "./CompanyProfile";
import { SocialSetupReminder } from "@/components/dashboard/social-setup-reminder";

interface SocialMediaUrls {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
  customWebhook: string;
}

interface SocialMediaKeys {
  // Facebook
  facebookPageId?: string;
  facebookAccessToken?: string;

  // Instagram
  instagramUserId?: string;
  instagramAccessToken?: string;

  // Twitter/X
  twitterApiKey?: string;
  twitterApiSecret?: string;
  twitterAccessToken?: string;
  twitterAccessTokenSecret?: string;

  // LinkedIn
  linkedinAccessToken?: string;
  linkedinOrganizationId?: string;

  // TikTok
  tiktokAccessToken?: string;
  tiktokOpenId?: string;

  // YouTube
  youtubeApiKey?: string;
  youtubeChannelId?: string;
}

export function UserSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [socialUrls, setSocialUrls] = useState<SocialMediaUrls>({
    facebook: "",
    instagram: "",
    linkedin: "",
    x: "",
    customWebhook: "",
  });
  const [socialKeys, setSocialKeys] = useState<SocialMediaKeys>({});

  useEffect(() => {
    // Fetch user settings when component mounts
    const fetchUserSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/user/settings");
        if (response.ok) {
          const data = await response.json();
          // Update state with fetched URLs
          setSocialUrls({
            facebook: data.facebookUrl || "",
            instagram: data.instagramUrl || "",
            linkedin: data.linkedinUrl || "",
            x: data.xUrl || "",
            customWebhook: data.customWebhook || "",
          });

          // Load API keys from localStorage for demo (in real app, would come from secure API)
          const savedKeys = localStorage.getItem(`social-keys-${user?.id}`);
          if (savedKeys) {
            setSocialKeys(JSON.parse(savedKeys));
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchUserSettings();
    }
  }, [user]);

  const handleInputChange = (
    platform: keyof SocialMediaUrls,
    value: string
  ) => {
    setSocialUrls((prev) => ({
      ...prev,
      [platform]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facebookUrl: socialUrls.facebook,
          instagramUrl: socialUrls.instagram,
          linkedinUrl: socialUrls.linkedin,
          xUrl: socialUrls.x,
          customWebhook: socialUrls.customWebhook,
        }),
      });

      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Your social media URLs have been updated.",
        });
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveApiKeys = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // In a real app, you'd save to your secure API
      // For demo purposes, using localStorage
      localStorage.setItem(
        `social-keys-${user.id}`,
        JSON.stringify(socialKeys)
      );

      toast({
        title: "Success",
        description: "API keys saved successfully",
      });
    } catch (error) {
      console.error("Error saving API keys:", error);
      toast({
        title: "Error",
        description: "Failed to save API keys",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SocialSetupReminder
        onSetupClick={() => setActiveTab("social")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="company">Company Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || ""} disabled />
                  </div>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={user?.name || user?.email || ""}
                      disabled
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="role">Account Type</Label>
                  <Input id="role" value={user?.type || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="id">User ID</Label>
                  <Input id="id" value={user?.id || ""} disabled />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <CompanyProfile />
        </TabsContent>
      </Tabs>
    </div>
  );
}
