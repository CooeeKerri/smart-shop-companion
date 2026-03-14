import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import ReceiptReview from "./pages/ReceiptReview";
import Analysis from "./pages/Analysis";
import Meals from "./pages/Meals";
import ShopHistory from "./pages/ShopHistory";
import Account from "./pages/Account";
import BudgetChat from "./pages/BudgetChat";
import OccasionChat from "./pages/OccasionChat";
import MealPlanner from "./pages/MealPlanner";
import Pantry from "./pages/Pantry";
import MakeOrBuy from "./pages/MakeOrBuy";
import ImpulseInsights from "./pages/ImpulseInsights";
import PriceComparison from "./pages/PriceComparison";
import Premium from "./pages/Premium";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/review" element={<ReceiptReview />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/meals" element={<Meals />} />
            <Route path="/history" element={<ShopHistory />} />
            <Route path="/account" element={<Account />} />
            <Route path="/budget-chat" element={<BudgetChat />} />
            <Route path="/occasion-chat" element={<OccasionChat />} />
            <Route path="/meal-planner" element={<MealPlanner />} />
            <Route path="/pantry" element={<Pantry />} />
            <Route path="/make-or-buy" element={<MakeOrBuy />} />
            <Route path="/impulse-insights" element={<ImpulseInsights />} />
            <Route path="/price-comparison" element={<PriceComparison />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
