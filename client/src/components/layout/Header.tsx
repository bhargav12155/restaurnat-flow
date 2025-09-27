import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Plus, ChevronDown, User } from "lucide-react";
import { useState, useEffect } from "react";

interface HeaderProps {
  title?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
}

export default function Header({ title = "Dashboard Overview", user }: HeaderProps) {
  const [isLiveSync, setIsLiveSync] = useState(true);
  const [notifications, setNotifications] = useState(3);

  // Simulate live sync status
  useEffect(() => {
    const interval = setInterval(() => {
      setIsLiveSync(prev => !prev);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const initials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}` 
    : "U";

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <div className="flex items-center space-x-2 px-3 py-1 bg-primary/10 rounded-full">
          <div className={`w-2 h-2 rounded-full ${isLiveSync ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm text-primary font-medium">
            {isLiveSync ? "Live Sync Active" : "Syncing..."}
          </span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Quick Actions */}
        <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
          <Plus className="w-4 h-4 mr-2" />
          Create Content
        </Button>
        
        {/* Notification Bell */}
        <div className="relative">
          <Button variant="ghost" size="icon">
            <Bell className="w-5 h-5" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-xs text-destructive-foreground flex items-center justify-center">
                {notifications}
              </span>
            )}
          </Button>
        </div>
        
        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-semibold text-xs">{initials}</span>
                )}
              </div>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => window.location.href = '/api/logout'}
              className="text-red-600"
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
