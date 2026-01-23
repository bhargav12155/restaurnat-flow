import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";

interface LoginPageProps {
  onSuccess?: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { universalLogin, checkAuth, error, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [userIdentifier, setUserIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const handleLoginSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      // Navigate to dashboard if no onSuccess callback provided
      setLocation("/");
    }
  };

  // Detect if we're in an iframe
  const isInIframe = () => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // If we can't access window.top due to same-origin policy, we're likely in an iframe
    }
  };

  // Listen for postMessage from iMakePage parent window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin for security (adjust allowed origins as needed)
      const allowedOrigins = [
        "https://www.imakepage.com",
        "https://imakepage.com",
      ];

      if (!allowedOrigins.includes(event.origin)) {
        return; // Ignore messages from untrusted origins
      }

      // Check if message contains iMakePage user data
      if (
        event.data &&
        event.data.source === "imakepage" &&
        event.data.userData
      ) {
        console.log("Received iMakePage user data via postMessage");
        setIsAutoLogging(true);

        try {
          const { userData } = event.data;

          // Extract identifier from iMakePage user data
          const identifier =
            userData.email ||
            userData.userEmail ||
            userData.profile?.email ||
            userData.user?.email;

          if (identifier) {
            setUserIdentifier(identifier);
            const loginResult = await universalLogin(identifier);

            if (loginResult.success) {
              setSuccess("Welcome from iMakePage!");
              setTimeout(() => handleLoginSuccess(), 1000);
            } else {
              setLocalError(
                "Auto-login failed. Please enter your identifier manually.",
              );
            }
          } else {
            setLocalError("Unable to extract user information from iMakePage.");
          }
        } catch (error) {
          console.error("iMakePage postMessage login error:", error);
          setLocalError(
            "Auto-login failed. Please enter your identifier manually.",
          );
        } finally {
          setIsAutoLogging(false);
        }
      }
    };

    // Add event listener for postMessage
    window.addEventListener("message", handleMessage);

    // Request user data from parent if in iframe
    if (isInIframe()) {
      console.log("In iframe - requesting user data from parent window");
      window.parent.postMessage(
        { source: "restaurantflow", action: "requestUserData" },
        "*", // Will be validated by the parent
      );
    }

    // Cleanup
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [universalLogin, onSuccess]);

  // Check for auto-login from URL parameters (iMakePage or external integration)
  useEffect(() => {
    const checkAutoLogin = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const userEmail = urlParams.get("userEmail");
      const autoLogin = urlParams.get("autoLogin");
      const source = urlParams.get("source");

      // Priority 1: iMakePage URL parameters
      if (autoLogin === "true" && userEmail && source === "imakepage") {
        console.log(
          "Auto-login detected from iMakePage URL params for:",
          userEmail,
        );
        setIsAutoLogging(true);
        setUserIdentifier(userEmail);

        try {
          const loginResult = await universalLogin(userEmail);

          if (loginResult.success) {
            setSuccess("Welcome from iMakePage!");
            setTimeout(() => handleLoginSuccess(), 1000);
          } else {
            setLocalError(
              loginResult.message ||
                "Auto-login failed. Please enter your identifier manually.",
            );
          }
        } catch (error) {
          console.error("Auto-login error:", error);
          setLocalError(
            "Auto-login failed. Please enter your identifier manually.",
          );
        } finally {
          setIsAutoLogging(false);
        }
        return;
      }

      // Priority 2: External integration URL parameters
      if (autoLogin === "true" && userEmail) {
        console.log("Auto-login detected from external integration for:", userEmail);
        setIsAutoLogging(true);
        setUserIdentifier(userEmail);

        try {
          const loginResult = await universalLogin(userEmail);

          if (loginResult.success) {
            setSuccess("Welcome to RestaurantFlow!");
            setTimeout(() => handleLoginSuccess(), 1000);
          } else {
            setLocalError(
              loginResult.message ||
                "Auto-login failed. Please enter your identifier manually.",
            );
          }
        } catch (error) {
          console.error("Auto-login error:", error);
          setLocalError(
            "Auto-login failed. Please enter your identifier manually.",
          );
        } finally {
          setIsAutoLogging(false);
        }
      }
    };

    checkAutoLogin();
  }, [universalLogin, onSuccess]);

  // Handle password-based login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccess(null);

    if (!userIdentifier.trim()) {
      setLocalError("Please enter your email");
      return;
    }
    if (!password) {
      setLocalError("Please enter your password");
      return;
    }

    setIsPasswordLoading(true);

    try {
      const response = await fetch("/api/auth/login-with-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: userIdentifier.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Welcome to RestaurantFlow!");
        // Refresh auth state to recognize the new session
        await checkAuth();
        setTimeout(() => handleLoginSuccess(), 500);
      } else if (data.requiresVerification) {
        setLocalError("Please verify your email before signing in. Check your inbox for the verification link.");
      } else {
        setLocalError(data.error || "Invalid email or password");
      }
    } catch (err) {
      setLocalError("Network error. Please try again.");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // Handle universal login - determine user type automatically
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccess(null);

    if (!userIdentifier.trim()) {
      setLocalError("Please enter a user identifier");
      return;
    }

    const identifier = userIdentifier.trim();

    // Use the new universal login method
    const loginResult = await universalLogin(identifier);

    if (loginResult.success) {
      setSuccess("Welcome to RestaurantFlow!");
      setTimeout(() => handleLoginSuccess(), 1000);
    } else {
      setLocalError(
        loginResult.message ||
          "Authentication failed. Please check your identifier.",
      );
    }
  };

  const handleDemoAccess = async () => {
    setLocalError(null);
    setSuccess(null);
    setIsDemoLoading(true);

    try {
      const response = await fetch("/api/demo/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        setSuccess("Demo account created! Redirecting...");
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } else {
        const errorData = await response.json();
        setLocalError(errorData.error || "Failed to create demo account");
      }
    } catch (error) {
      console.error("Demo access error:", error);
      setLocalError("Failed to create demo account. Please try again.");
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100 p-4 sm:p-6">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 sm:border">
        <CardHeader className="text-center px-6 pt-8 pb-4 sm:px-8 sm:pt-10">
          <CardTitle className="text-2xl sm:text-3xl font-bold">🍽️ RestaurantFlow</CardTitle>
          <CardDescription className="text-base mt-2">Restaurant Marketing Platform</CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8 sm:px-8 sm:pb-10">
          {/* Show errors/success */}
          {(error || localError) && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                {error || localError}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={userIdentifier}
                onChange={(e) => setUserIdentifier(e.target.value)}
                placeholder="john@restaurant.com"
                disabled={isPasswordLoading}
                autoFocus
                className="h-12 text-base px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isPasswordLoading}
                className="h-12 text-base px-4"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-[0.98] transition-transform"
              disabled={isPasswordLoading || isAutoLogging}
            >
              {isPasswordLoading || isAutoLogging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link href="/signup" className="text-orange-600 hover:text-orange-700 font-medium">
                  Sign up free
                </Link>
              </p>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 hover:from-purple-100 hover:to-indigo-100 text-purple-700 active:scale-[0.98] transition-transform"
                onClick={handleDemoAccess}
                disabled={isDemoLoading || isLoading}
                data-testid="button-demo-access"
              >
                {isDemoLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating demo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Try Demo
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-400">
                Experience the full platform with sample data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
