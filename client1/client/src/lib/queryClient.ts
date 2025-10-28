import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Helper function to get authentication bypass parameters from current URL
function getBypassAuthParams(): URLSearchParams {
  const currentUrl = new URL(window.location.href);
  const bypassParams = new URLSearchParams();
  
  if (currentUrl.searchParams.get('bypassAuth') === 'true') {
    const userId = currentUrl.searchParams.get('userId');
    const userType = currentUrl.searchParams.get('userType');
    const agentSlug = currentUrl.searchParams.get('agentSlug');
    const username = currentUrl.searchParams.get('username');
    
    if (userId && userType) {
      bypassParams.set('bypassAuth', 'true');
      bypassParams.set('userId', userId);
      bypassParams.set('userType', userType);
      if (agentSlug) bypassParams.set('agentSlug', agentSlug);
      if (username) bypassParams.set('username', username);
    }
  }
  
  return bypassParams;
}

// Helper function to append bypass params to URL
function appendBypassParams(url: string): string {
  const bypassParams = getBypassAuthParams();
  if (bypassParams.toString()) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${bypassParams.toString()}`;
  }
  return url;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Include bypass authentication parameters if present in current URL
  const finalUrl = appendBypassParams(url);
  
  const res = await fetch(finalUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Include bypass authentication parameters if present in current URL
    const baseUrl = queryKey.join("/") as string;
    const finalUrl = appendBypassParams(baseUrl);
    
    const res = await fetch(finalUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
