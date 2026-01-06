import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  User,
  Lock,
  ChevronRight,
  Briefcase,
  Users,
  UserCheck,
  Eye,
  EyeOff,
} from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hoveredDemo, setHoveredDemo] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user) {
        toast.success("Login berhasil!");
        navigate("/dashboard");
      } else {
        toast.error("Email atau password salah");
      }
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    {
      role: "Staff",
      email: "staff@sawit.com",
      password: "password123",
      icon: Briefcase,
      gradient: "from-orange-500 to-red-500",
    },
    {
      role: "Non-Staff",
      email: "nonstaff@sawit.com",
      password: "password123",
      icon: Users,
      gradient: "from-blue-500 to-cyan-500",
    },
  ];

  const quickLogin = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/sawit.jpg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 via-green-800/90 to-emerald-900/95 backdrop-blur-sm"></div>
      </div>

      {/* Animated Background Patterns */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-green-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="text-white space-y-6 hidden lg:block">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-300 via-orange-200 to-yellow-200 animate-pulse">
              Palma ROOTS
            </h1>
            <h2 className="text-3xl font-semibold">
              Sistem Pencatatan Kebun Sawit
            </h2>
            <p className="text-lg text-green-100/80 leading-relaxed">
              Solusi digital profesional untuk manajemen perkebunan kelapa
              sawit. Sistem siap pakai dengan fitur lengkap dan terintegrasi.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-3 text-green-100">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span>Pencatatan aktivitas real-time</span>
            </div>
            <div className="flex items-center gap-3 text-green-100">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse delay-100"></div>
              <span>Manajemen karyawan terintegrasi</span>
            </div>
            <div className="flex items-center gap-3 text-green-100">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse delay-200"></div>
              <span>Laporan komprehensif & analitik</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="w-full">
          {/* Mobile Branding */}
          <div className="lg:hidden text-center mb-8 text-white">
            <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-orange-300 to-yellow-200">
              Palma ROOTS
            </h1>
            <p className="text-green-100/80">
              Sistem Manajemen Perkebunan Sawit
            </p>
          </div>

          {/* Login Card with Glassmorphism */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-white">Selamat Datang</h3>
              <p className="text-green-100/70">
                Masuk ke akun Anda untuk melanjutkan
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white font-medium">
                  Email
                </Label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-300/60 group-focus-within:text-orange-400 transition-colors w-5 h-5" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Masukkan alamat email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-11 bg-white/10 border-white/30 text-white placeholder:text-green-100/40 focus:bg-white/20 focus:border-orange-400 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white font-medium">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-300/60 group-focus-within:text-orange-400 transition-colors w-5 h-5" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-11 pr-11 bg-white/10 border-white/30 text-white placeholder:text-green-100/40 focus:bg-white/20 focus:border-orange-400 transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-300/60 hover:text-orange-400 transition-colors focus:outline-none"
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 group"
                disabled={loading}
              >
                <span>{loading ? "Memproses..." : "Masuk"}</span>
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>

            {/* Demo Accounts Section */}
            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                <p className="text-xs font-semibold text-green-100/70 uppercase tracking-wider">
                  Coba Sistem - Akun Testing
                </p>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              </div>

              <div className="grid gap-2">
                {demoAccounts.map((account) => {
                  const IconComponent = account.icon;
                  return (
                    <button
                      key={account.role}
                      type="button"
                      onClick={() =>
                        quickLogin(account.email, account.password)
                      }
                      onMouseEnter={() => setHoveredDemo(account.role)}
                      onMouseLeave={() => setHoveredDemo(null)}
                      className="group relative overflow-hidden bg-white/5 hover:bg-white/15 border border-white/20 hover:border-white/40 rounded-lg p-3 transition-all duration-300 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg bg-gradient-to-br ${account.gradient} shadow-lg`}
                        >
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {account.role}
                          </p>
                          <p className="text-xs text-green-100/60 truncate">
                            {account.email}
                          </p>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-green-100/40 transition-all duration-300 ${hoveredDemo === account.role
                              ? "translate-x-1 text-orange-400"
                              : ""
                            }`}
                        />
                      </div>
                      {hoveredDemo === account.role && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <p className="text-center text-green-100/50 text-xs mt-6">
            © 2025 Palma ROOTS by Palma Group. Sistem Manajemen Perkebunan
            Sawit.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
