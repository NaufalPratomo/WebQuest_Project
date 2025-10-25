import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/master/Employees";
import Locations from "./pages/master/Locations";
import Targets from "./pages/master/Targets";
import InputReport from "./pages/activities/InputReport";
import History from "./pages/activities/History";
import Verification from "./pages/Verification";
import Recap from "./pages/Recap";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import TaksasiPanen from "./pages/manager/TaksasiPanen";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['manager', 'foreman']}>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/master/employees" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Layout><Employees /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/master/locations" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Layout><Locations /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/master/targets" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Layout><Targets /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/activities/input" element={
              <ProtectedRoute allowedRoles={['manager', 'foreman', 'employee']}>
                <Layout><InputReport /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/activities/history" element={
              <ProtectedRoute allowedRoles={['manager', 'foreman', 'employee']}>
                <Layout><History /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/verification" element={
              <ProtectedRoute allowedRoles={['foreman']}>
                <Layout><Verification /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/recap" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Layout><Recap /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['manager', 'foreman']}>
                <Layout><Reports /></Layout>
              </ProtectedRoute>
            } />

            <Route path="/taksasi" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Layout><TaksasiPanen /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
