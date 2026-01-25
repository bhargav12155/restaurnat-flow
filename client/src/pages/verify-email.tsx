import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Mail, ArrowRight } from "lucide-react";

type VerificationStatus = "loading" | "success" | "error" | "expired";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      // Get token from URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("No verification token found. Please check your email link.");
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (data.success) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified successfully!");
          setEmail(data.email || "");
        } else if (data.error?.includes("expired")) {
          setStatus("expired");
          setMessage(data.error);
          setEmail(data.email || "");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. Please try again.");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    };

    verifyEmail();
  }, []);

  const handleResendVerification = async () => {
    if (!email) {
      setMessage("No email found. Please sign up again.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage("A new verification email has been sent. Please check your inbox.");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to resend verification email.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <>
            <CardHeader className="text-center px-6 py-12 sm:px-8 sm:py-16">
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold">Verifying Your Email</CardTitle>
              <CardDescription className="text-base mt-2">Please wait while we verify your email address...</CardDescription>
            </CardHeader>
          </>
        );

      case "success":
        return (
          <>
            <CardHeader className="text-center px-6 pt-8 sm:px-8 sm:pt-10">
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold text-green-700">Email Verified!</CardTitle>
              <CardDescription className="text-base mt-2">{message}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4 px-6 pb-8 sm:px-8 sm:pb-10">
              <p className="text-gray-600">
                Your account is now active. You can sign in and start using MarketingFlow.
              </p>
              <Link href="/login">
                <Button className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-[0.98] transition-transform">
                  Sign In to Your Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </>
        );

      case "expired":
        return (
          <>
            <CardHeader className="text-center px-6 pt-8 sm:px-8 sm:pt-10">
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold text-yellow-700">Link Expired</CardTitle>
              <CardDescription className="text-base mt-2">{message}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4 px-6 pb-8 sm:px-8 sm:pb-10">
              <p className="text-gray-600">
                Verification links expire after 24 hours for security. Request a new one below.
              </p>
              <Button
                onClick={handleResendVerification}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-[0.98] transition-transform"
              >
                Send New Verification Email
              </Button>
              <Link href="/login">
                <Button variant="ghost" className="w-full h-12 text-base">
                  Back to Login
                </Button>
              </Link>
            </CardContent>
          </>
        );

      case "error":
        return (
          <>
            <CardHeader className="text-center px-6 pt-8 sm:px-8 sm:pt-10">
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold text-red-700">Verification Failed</CardTitle>
              <CardDescription className="text-base mt-2">{message}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4 px-6 pb-8 sm:px-8 sm:pb-10">
              <p className="text-gray-600">
                There was a problem verifying your email. Please try signing up again or contact support.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/signup" className="flex-1">
                  <Button variant="outline" className="w-full h-12 text-base active:scale-[0.98] transition-transform">
                    Sign Up Again
                  </Button>
                </Link>
                <Link href="/login" className="flex-1">
                  <Button variant="ghost" className="w-full h-12 text-base">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100 p-4 sm:p-6">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 sm:border">
        {renderContent()}
      </Card>
    </div>
  );
}
