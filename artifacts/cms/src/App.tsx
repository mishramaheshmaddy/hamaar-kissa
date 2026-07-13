import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Categories from "@/pages/categories";
import CategoryForm from "@/pages/category-form";
import AudioStories from "@/pages/audio-stories";
import AudioStoryForm from "@/pages/audio-story-form";
import Videos from "@/pages/videos";
import VideoForm from "@/pages/video-form";
import HomeScreenManager from "@/pages/home-screen";
import UserSubmissions from "@/pages/user-submissions";
import UserSubmissionDetail from "@/pages/user-submission-detail";
import BulkUpload from "@/pages/bulk-upload";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function Router() {
  const { email, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!email) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/categories" component={Categories} />
        <Route path="/categories/new" component={CategoryForm} />
        <Route path="/categories/:id" component={CategoryForm} />
        <Route path="/audio-stories" component={AudioStories} />
        <Route path="/audio-stories/new" component={AudioStoryForm} />
        <Route path="/audio-stories/:id" component={AudioStoryForm} />
        <Route path="/videos" component={Videos} />
        <Route path="/videos/new" component={VideoForm} />
        <Route path="/videos/:id" component={VideoForm} />
        <Route path="/bulk-upload" component={BulkUpload} />
        <Route path="/home-screen" component={HomeScreenManager} />
        <Route path="/user-submissions/:id" component={UserSubmissionDetail} />
        <Route path="/user-submissions" component={UserSubmissions} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
