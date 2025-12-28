import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RouteLogger from "@/components/RouteLogger";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClosingProvider } from "@/contexts/ClosingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/master/Users";
import Workers from "./pages/master/Workers";
import Companies from "./pages/master/Companies";
import Locations from "./pages/master/Locations";
import Pekerjaan from "./pages/master/Pekerjaan";
import Targets from "./pages/master/RealHarvest";
import InputReport from "./pages/activities/InputReport";
import History from "./pages/activities/History";
import Verification from "./pages/Verification";
import Recap from "./pages/Recap";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import TaksasiPanen from "./pages/manager/TaksasiPanen";
import Harvest from "./pages/transactions/Harvest";
import Transport from "./pages/transactions/Transport";
import Attendance from "./pages/transactions/Attendance";
import Upah from "./pages/transactions/Upah";
import Closing from "./pages/transactions/Closing";
import TaksasiPerBlock from "./pages/reports/TaksasiPerBlock";
import Trend from "./pages/reports/Trend";
import Statement from "./pages/reports/Statement";
import ActivityLog from "./pages/ActivityLog";
import InputDailyReport from "./pages/reports/InputDailyReport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ClosingProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteLogger />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/master/users"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Users />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/master/workers"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Workers />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/master/companies"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Companies />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/master/locations"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Locations />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/master/pekerjaan"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Pekerjaan />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/master/targets"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Targets />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/panen"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Harvest />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/angkut"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Transport />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/attendance"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Attendance />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/upah"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Upah />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/closing"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Closing />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Reports */}
              <Route
                path="/reports/daily-input"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <InputDailyReport />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/taksasi"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <TaksasiPerBlock />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/trend"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Trend />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/statement"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Statement />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/activities/input"
                element={
                  <ProtectedRoute
                    allowedRoles={["manager", "foreman", "employee"]}
                  >
                    <Layout>
                      <InputReport />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/activities/history"
                element={
                  <ProtectedRoute
                    allowedRoles={["manager", "foreman", "employee"]}
                  >
                    <Layout>
                      <History />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/verification"
                element={
                  <ProtectedRoute allowedRoles={["foreman"]}>
                    <Layout>
                      <Verification />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/recap"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <Recap />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/activity-logs"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <ActivityLog />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={["manager", "foreman"]}>
                    <Layout>
                      <Reports />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/taksasi"
                element={
                  <ProtectedRoute allowedRoles={["manager"]}>
                    <Layout>
                      <TaksasiPanen />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ClosingProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
