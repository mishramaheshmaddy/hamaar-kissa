import { useState } from "react";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm">
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-primary px-8 py-6 text-white">
            <div className="flex items-center gap-3 mb-1">
              <span className="bg-white/20 text-white font-bold px-2 py-1 rounded text-sm">HK</span>
              <span className="font-bold text-lg">Hamaar Kissa</span>
            </div>
            <p className="text-primary-foreground/80 text-sm">Admin Control Room</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-3">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-semibold text-foreground">Sign in</h2>
              <p className="text-muted-foreground text-sm">Enter your admin credentials</p>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
