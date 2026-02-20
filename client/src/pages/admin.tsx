import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Lock, Shield, User, Mail, Calendar } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  username?: string;
  name: string;
  email: string;
  role: string;
  isDemo: boolean;
  createdAt: string;
  type: 'agent' | 'public';
  agentSlug?: string;
  emailVerified?: boolean;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        localStorage.setItem("adminPassword", password);
        loadUsers();
        toast({
          title: "Access granted",
          description: "You are now authenticated as admin",
        });
      } else {
        toast({
          title: "Access denied",
          description: "Invalid admin password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to authenticate",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const savedPassword = localStorage.getItem("adminPassword");
    if (!savedPassword) return;

    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${savedPassword}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    const savedPassword = localStorage.getItem("adminPassword");
    if (!savedPassword) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${deleteUser.type}/${deleteUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${savedPassword}`,
        },
      });

      if (response.ok) {
        toast({
          title: "User deleted",
          description: `${deleteUser.email} has been removed`,
        });
        setUsers(users.filter(u => !(u.id === deleteUser.id && u.type === deleteUser.type)));
        setDeleteUser(null);
      } else {
        toast({
          title: "Error",
          description: "Failed to delete user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedPassword = localStorage.getItem("adminPassword");
    if (savedPassword) {
      setPassword(savedPassword);
      fetch("/api/admin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: savedPassword }),
      }).then(response => {
        if (response.ok) {
          setIsAuthenticated(true);
          loadUsers();
        } else {
          localStorage.removeItem("adminPassword");
        }
      });
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar activeView="admin" />
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <CardTitle>Admin Access</CardTitle>
              </div>
              <CardDescription>
                Enter the admin password to access user management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Admin Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter admin password"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Authenticating..." : "Access Admin Panel"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView="admin" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              <p className="text-gray-500 mt-1">Manage all users</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem("adminPassword");
                setIsAuthenticated(false);
              }}
            >
              Logout
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Users ({users.length})</CardTitle>
              <CardDescription>
                Agent users and public users from all accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No users found</div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={`${user.type}-${user.id}`}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium truncate">{user.name}</span>
                          <Badge variant={user.type === 'agent' ? 'default' : 'secondary'}>
                            {user.type}
                          </Badge>
                          {user.isDemo && (
                            <Badge variant="outline">Demo</Badge>
                          )}
                          {user.type === 'public' && user.emailVerified && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          {user.username && (
                            <span>@{user.username}</span>
                          )}
                          {user.agentSlug && (
                            <span>Agent: {user.agentSlug}</span>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteUser(user)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user <strong>{deleteUser?.email}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
