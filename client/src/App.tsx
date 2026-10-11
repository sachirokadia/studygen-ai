import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth";
import { LangProvider, useLang } from "./lib/i18n";
import Layout from "./components/Layout";
import { LoadingState } from "./components/ui";
import type { ReactNode } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Decks from "./pages/Decks";
import DeckDetail from "./pages/DeckDetail";
import Review from "./pages/Review";
import QuizTake from "./pages/QuizTake";
import QuizReview from "./pages/QuizReview";
import Notes from "./pages/Notes";
import Paths from "./pages/Paths";
import PathDetail from "./pages/PathDetail";
import Explain from "./pages/Explain";
import Chat from "./pages/Chat";
import Bookmarks from "./pages/Bookmarks";
import Admin from "./pages/Admin";
import Me from "./pages/Me";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLang();
  if (loading) return <LoadingState label={t("common.loading")} />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/*"
                element={
                  <Protected>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/decks" element={<Decks />} />
                        <Route path="/decks/:id" element={<DeckDetail />} />
                        <Route path="/review" element={<Review />} />
                        <Route path="/quiz/:id" element={<QuizTake />} />
                        <Route path="/quiz/:id/review" element={<QuizReview />} />
                        <Route path="/notes" element={<Notes />} />
                        <Route path="/paths" element={<Paths />} />
                        <Route path="/paths/:id" element={<PathDetail />} />
                        <Route path="/explain" element={<Explain />} />
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/bookmarks" element={<Bookmarks />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/me" element={<Me />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Layout>
                  </Protected>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}
