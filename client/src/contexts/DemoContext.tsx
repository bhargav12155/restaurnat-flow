import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface DemoContextType {
  isDemo: boolean;
  demoSocialAccounts: DemoSocialAccount[];
}

interface DemoSocialAccount {
  id: string;
  platform: string;
  accountUsername: string;
  isConnected: boolean;
  profileImage?: string;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_SOCIAL_ACCOUNTS: DemoSocialAccount[] = [
  {
    id: 'demo-facebook',
    platform: 'facebook',
    accountUsername: 'Demo Restaurant',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-instagram',
    platform: 'instagram',
    accountUsername: '@demorestaurant',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-linkedin',
    platform: 'linkedin',
    accountUsername: 'Demo Restaurant',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-x',
    platform: 'x',
    accountUsername: '@DemoRestaurant',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-youtube',
    platform: 'youtube',
    accountUsername: 'Demo Restaurant Channel',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-tiktok',
    platform: 'tiktok',
    accountUsername: '@demorestaurant',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'
  }
];

export function DemoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (user && (user as any).isDemo) {
      setIsDemo(true);
    } else {
      setIsDemo(false);
    }
  }, [user]);

  return (
    <DemoContext.Provider value={{ isDemo, demoSocialAccounts: DEMO_SOCIAL_ACCOUNTS }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
