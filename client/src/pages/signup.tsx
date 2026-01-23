import { useState } from "react";
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
import { Loader2, UserPlus, CheckCircle2, Mail } from "lucide-react";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!formData.email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!formData.password) {
      setError("Please enter a password");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Signup failed. Please try again.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Success state - show verification email sent message
  if (success) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100 p-4 sm:p-6">
        <Card className="w-full max-w-md mx-auto shadow-xl border-0 sm:border">
          <CardHeader className="text-center px-6 pt-8 sm:px-8 sm:pt-10">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-green-700">Check Your Email</CardTitle>
            <CardDescription className="text-base mt-2">
              We've sent a verification link to
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4 px-6 pb-8 sm:px-8 sm:pb-10">
            <p className="font-semibold text-lg text-gray-800 break-all">{formData.email}</p>
            <p className="text-gray-600 text-sm">
              Click the link in the email to activate your account and start using RestaurantFlow.
            </p>
            <div className="pt-4 border-t space-y-3">
              <p className="text-xs text-gray-500">
                Didn't receive the email? Check your spam folder or
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSuccess(false)}
                  className="flex-1 h-11 active:scale-[0.98] transition-transform"
                >
                  Try Again
                </Button>
                <Link href="/login" className="flex-1">
                  <Button variant="ghost" className="w-full h-11">Back to Login</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100 p-4 sm:p-6">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 sm:border">
        <CardHeader className="text-center px-6 pt-8 pb-2 sm:px-8 sm:pt-10">
          <CardTitle className="text-2xl sm:text-3xl font-bold">🍽️ RestaurantFlow</CardTitle>
          <CardDescription className="text-base mt-2">Create your restaurant marketing account</CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8 sm:px-8 sm:pb-10">
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-4">
              <UserPlus className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-orange-500 mb-2" />
              <h3 className="text-lg font-medium text-gray-900">Get Started Free</h3>
              <p className="text-sm text-gray-500">
                No credit card required
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="John Smith"
                disabled={isLoading}
                autoFocus
                className="h-12 text-base px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@restaurant.com"
                disabled={isLoading}
                className="h-12 text-base px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                disabled={isLoading}
                className="h-12 text-base px-4"
              />
              <p className="text-xs text-gray-500">At least 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••"
                disabled={isLoading}
                className="h-12 text-base px-4"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-[0.98] transition-transform"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
