import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, FileText, CheckCircle, Target, TrendingUp, Activity, Building2, Award } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, isSameDay, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

const Dashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{
        totalEmployees: number;
        todayReports: number;
        pendingCount: number;
        targetsPercent: number;
    } | null>(null);
    const [chartData, setChartData] = useState<Array<{ date: string; Taksasi: number; Realisasi: number }>>([]);
    const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
    const [selectedEstate, setSelectedEstate] = useState<string>("all");
    const [dateRange, setDateRange] = useState<string>("month");

    // Production Data (Taksasi & Panen)
    const [productionData, setProductionData] = useState<{
        totalTaksasi: number;
        totalPanen: number;
        totalAngkut: number;
        efficiencyRate: number;
        avgAKP: number;
        monthlyProduction: Array<{ month: string; taksasi: number; panen: number; angkut: number }>;
        divisionProduction: Array<{ division: string; taksasi: number; panen: number }>;
        blockPerformance: Array<{ block: string; taksasi: number; panen: number; efficiency: number }>;
    }>({
        totalTaksasi: 0,
        totalPanen: 0,
        totalAngkut: 0,
        efficiencyRate: 0,
        avgAKP: 0,
        monthlyProduction: [],
        divisionProduction: [],
        blockPerformance: []
    });

    // Employee & Company Data
    const [employeeData, setEmployeeData] = useState<{
        totalEmployees: number;
        activeEmployees: number;
        inactiveEmployees: number;
        companyDistribution: Array<{ name: string; value: number }>;
        positionDistribution: Array<{ name: string; value: number }>;
        genderDistribution: Array<{ name: string; value: number }>;
    }>({
        totalEmployees: 0,
        activeEmployees: 0,
        inactiveEmployees: 0,
        companyDistribution: [],
        positionDistribution: [],
        genderDistribution: []
    });

    // HSE & Sustainability Data
    const [hseData, setHSEData] = useState<{
        wasteRate: number;
        transportEfficiency: number;
        sustainabilityScore: number;
        monthlyEfficiency: Array<{ month: string; efficiency: number; waste: number; akp: number }>;
        divisionPerformance: Array<{ division: string; taksasi: number; panen: number; efficiency: number; akp: number }>;
        safetyScore: number;
    }>({
        wasteRate: 0,
        transportEfficiency: 0,
        sustainabilityScore: 0,
        monthlyEfficiency: [],
        divisionPerformance: [],
        safetyScore: 0
    });

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);

                // Fetch estates if not already loaded
                if (estates.length === 0) {
                    const estatesData = await api.estates();
                    if (mounted) setEstates(estatesData);
                }

                // Determine date range
                const now = new Date();
                let start: Date, end: Date;
                
                if (dateRange === "week") {
                    start = new Date(now);
                    start.setDate(now.getDate() - 7);
                    end = now;
                } else if (dateRange === "month") {
                    start = startOfMonth(now);
                    end = endOfMonth(now);
                } else if (dateRange === "quarter") {
                    start = subMonths(now, 3);
                    end = now;
                } else { // year
                    start = startOfYear(now);
                    end = endOfYear(now);
                }

                const startStr = format(start, 'yyyy-MM-dd');
                const endStr = format(end, 'yyyy-MM-dd');

                // Fetch stats with estate filter
                const filterParams = selectedEstate !== "all" ? { estateId: selectedEstate } : {};
                const statsData = await api.stats(filterParams);
                if (mounted) setStats(statsData);

                // Fetch all data in parallel
                const [taksasi, panen, angkut, employees, companies] = await Promise.all([
                    api.taksasiList({ startDate: startStr, endDate: endStr, ...filterParams }),
                    api.panenList({ startDate: startStr, endDate: endStr, ...filterParams }),
                    api.angkutList({ ...filterParams }),
                    api.employees(),
                    api.companies()
                ]);

                // ============ CHART DATA (Overview) ============
                const days = dateRange === "month" 
                    ? eachDayOfInterval({ start, end })
                    : eachMonthOfInterval({ start, end });
                
                const data = days.map(day => {
                    const dayTotalTaksasi = taksasi
                        .filter(row => {
                            const rowDate = parseISO(row.date);
                            return dateRange === "month" 
                                ? isSameDay(rowDate, day)
                                : rowDate.getMonth() === day.getMonth() && rowDate.getFullYear() === day.getFullYear();
                        })
                        .reduce((sum, row) => sum + (row.weightKg || 0), 0);

                    const dayTotalPanen = panen
                        .filter(row => {
                            const rowDate = parseISO(row.date_panen);
                            return dateRange === "month"
                                ? isSameDay(rowDate, day)
                                : rowDate.getMonth() === day.getMonth() && rowDate.getFullYear() === day.getFullYear();
                        })
                        .reduce((sum, row) => sum + (row.weightKg || 0), 0);

                    return {
                        date: dateRange === "month" 
                            ? format(day, 'd MMM', { locale: id })
                            : format(day, 'MMM yyyy', { locale: id }),
                        Taksasi: Math.round(dayTotalTaksasi),
                        Realisasi: Math.round(dayTotalPanen)
                    };
                });

                if (mounted) setChartData(data);

                // ============ PRODUCTION DATA ============
                const totalTaksasi = taksasi.reduce((sum, t) => sum + (t.weightKg || 0), 0);
                const totalPanen = panen.reduce((sum, p) => sum + (p.weightKg || 0), 0);
                const totalAngkut = angkut.reduce((sum, a) => sum + (a.weightKg || 0), 0);
                const efficiencyRate = totalTaksasi > 0 ? (totalPanen / totalTaksasi) * 100 : 0;
                const avgAKP = taksasi.length > 0 
                    ? taksasi.reduce((sum, t) => sum + (t.akpPercent || 0), 0) / taksasi.length 
                    : 0;

                // Monthly production trend
                const monthlyProduction = dateRange === "year" ? eachMonthOfInterval({ start, end }).map(month => {
                    const monthTaksasi = taksasi.filter(t => {
                        const d = parseISO(t.date);
                        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
                    });
                    const monthPanen = panen.filter(p => {
                        const d = parseISO(p.date_panen);
                        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
                    });
                    const monthAngkut = angkut.filter(a => {
                        const d = parseISO(a.date_angkut);
                        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
                    });
                    return {
                        month: format(month, 'MMM', { locale: id }),
                        taksasi: Math.round(monthTaksasi.reduce((sum, t) => sum + (t.weightKg || 0), 0)),
                        panen: Math.round(monthPanen.reduce((sum, p) => sum + (p.weightKg || 0), 0)),
                        angkut: Math.round(monthAngkut.reduce((sum, a) => sum + (a.weightKg || 0), 0))
                    };
                }) : [];

                // Division production
                const formatDiv = (val: number | string) => {
                    if (!val) return 'Unknown';
                    const num = Number(val);
                    if (!Number.isNaN(num) && typeof val !== 'string') return `Divisi ${val}`;
                    if (typeof val === 'string' && /^\d+$/.test(val)) return `Divisi ${val}`;
                    return String(val);
                };

                const divisionStats: Record<string, { taksasi: number; panen: number }> = {};
                taksasi.forEach(t => {
                    const div = formatDiv(t.division_id);
                    if (!divisionStats[div]) divisionStats[div] = { taksasi: 0, panen: 0 };
                    divisionStats[div].taksasi += t.weightKg || 0;
                });
                panen.forEach(p => {
                    const div = formatDiv(p.division_id);
                    if (!divisionStats[div]) divisionStats[div] = { taksasi: 0, panen: 0 };
                    divisionStats[div].panen += p.weightKg || 0;
                });
                const divisionProduction = Object.entries(divisionStats).map(([division, data]) => ({
                    division,
                    taksasi: Math.round(data.taksasi),
                    panen: Math.round(data.panen)
                }));

                // Block performance
                const blockStats: Record<string, { taksasi: number; panen: number }> = {};
                taksasi.forEach(t => {
                    const key = t.block_no || 'Unknown';
                    if (!blockStats[key]) blockStats[key] = { taksasi: 0, panen: 0 };
                    blockStats[key].taksasi += t.weightKg || 0;
                });
                panen.forEach(p => {
                    const key = p.block_no || 'Unknown';
                    if (!blockStats[key]) blockStats[key] = { taksasi: 0, panen: 0 };
                    blockStats[key].panen += p.weightKg || 0;
                });
                const blockPerformance = Object.entries(blockStats)
                    .map(([block, data]) => ({
                        block,
                        taksasi: Math.round(data.taksasi),
                        panen: Math.round(data.panen),
                        efficiency: data.taksasi > 0 ? Math.round((data.panen / data.taksasi) * 100 * 10) / 10 : 0
                    }))
                    .sort((a, b) => b.panen - a.panen)
                    .slice(0, 10);

                if (mounted) {
                    setProductionData({
                        totalTaksasi: Math.round(totalTaksasi),
                        totalPanen: Math.round(totalPanen),
                        totalAngkut: Math.round(totalAngkut),
                        efficiencyRate: Math.round(efficiencyRate * 10) / 10,
                        avgAKP: Math.round(avgAKP * 10) / 10,
                        monthlyProduction,
                        divisionProduction,
                        blockPerformance
                    });
                }

                // ============ EMPLOYEE DATA ============
                const activeEmployees = employees.filter(e => e.status === 'active').length;
                const inactiveEmployees = employees.filter(e => e.status === 'inactive').length;

                // Company distribution
                const companyCount: Record<string, number> = {};
                employees.forEach(e => {
                    if (e.companyId) {
                        const company = companies.find(c => c._id === e.companyId);
                        const companyName = company?.company_name || 'Unknown';
                        companyCount[companyName] = (companyCount[companyName] || 0) + 1;
                    }
                });
                const companyDistribution = Object.entries(companyCount).map(([name, value]) => ({ name, value }));

                // Position distribution
                const positionCount: Record<string, number> = {};
                employees.forEach(e => {
                    const position = e.position || 'Tidak ada posisi';
                    positionCount[position] = (positionCount[position] || 0) + 1;
                });
                const positionDistribution = Object.entries(positionCount).map(([name, value]) => ({ name, value }));

                // Gender distribution
                const genderCount: Record<string, number> = {};
                employees.forEach(e => {
                    const gender = e.gender === 'L' ? 'Laki-laki' : e.gender === 'P' ? 'Perempuan' : 'Tidak diketahui';
                    genderCount[gender] = (genderCount[gender] || 0) + 1;
                });
                const genderDistribution = Object.entries(genderCount).map(([name, value]) => ({ name, value }));

                if (mounted) {
                    setEmployeeData({
                        totalEmployees: employees.length,
                        activeEmployees,
                        inactiveEmployees,
                        companyDistribution,
                        positionDistribution,
                        genderDistribution
                    });
                }

                // ============ HSE & SUSTAINABILITY DATA ============
                const wasteRate = totalTaksasi > 0 ? ((totalTaksasi - totalPanen) / totalTaksasi) * 100 : 0;
                const transportEfficiency = totalPanen > 0 ? (totalAngkut / totalPanen) * 100 : 0;
                
                // Sustainability score (composite from efficiency, AKP, and transport)
                const sustainabilityScore = Math.round((
                    (efficiencyRate / 100 * 40) + 
                    (avgAKP / 100 * 35) + 
                    (transportEfficiency / 100 * 25)
                ) * 100);

                // Safety score based on AKP (higher AKP = better quality harvesting)
                const safetyScore = avgAKP;

                // Monthly efficiency trend with AKP
                const monthlyEfficiency = dateRange === "year" ? eachMonthOfInterval({ start, end }).map(month => {
                    const monthTaksasi = taksasi.filter(t => {
                        const d = parseISO(t.date);
                        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
                    });
                    const monthPanen = panen.filter(p => {
                        const d = parseISO(p.date_panen);
                        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
                    });
                    const taksasiTotal = monthTaksasi.reduce((sum, t) => sum + (t.weightKg || 0), 0);
                    const panenTotal = monthPanen.reduce((sum, p) => sum + (p.weightKg || 0), 0);
                    const eff = taksasiTotal > 0 ? (panenTotal / taksasiTotal) * 100 : 0;
                    const monthAKP = monthTaksasi.length > 0 
                        ? monthTaksasi.reduce((sum, t) => sum + (t.akpPercent || 0), 0) / monthTaksasi.length 
                        : 0;
                    return {
                        month: format(month, 'MMM', { locale: id }),
                        efficiency: Math.round(eff * 10) / 10,
                        waste: Math.round((100 - eff) * 10) / 10,
                        akp: Math.round(monthAKP * 10) / 10
                    };
                }) : [];

                // Division performance (tidak pakai target)
                const divisionPerformanceMap: Record<string, { taksasi: number; panen: number; akpSum: number; akpCount: number }> = {};
                taksasi.forEach(t => {
                    const div = formatDiv(t.division_id);
                    if (!divisionPerformanceMap[div]) divisionPerformanceMap[div] = { taksasi: 0, panen: 0, akpSum: 0, akpCount: 0 };
                    divisionPerformanceMap[div].taksasi += t.weightKg || 0;
                    divisionPerformanceMap[div].akpSum += t.akpPercent || 0;
                    divisionPerformanceMap[div].akpCount++;
                });
                panen.forEach(p => {
                    const div = formatDiv(p.division_id);
                    if (!divisionPerformanceMap[div]) divisionPerformanceMap[div] = { taksasi: 0, panen: 0, akpSum: 0, akpCount: 0 };
                    divisionPerformanceMap[div].panen += p.weightKg || 0;
                });
                const divisionPerformance = Object.entries(divisionPerformanceMap).map(([division, data]) => ({
                    division,
                    taksasi: Math.round(data.taksasi),
                    panen: Math.round(data.panen),
                    efficiency: data.taksasi > 0 ? Math.round((data.panen / data.taksasi) * 100 * 10) / 10 : 0,
                    akp: data.akpCount > 0 ? Math.round((data.akpSum / data.akpCount) * 10) / 10 : 0
                }));

                if (mounted) {
                    setHSEData({
                        wasteRate: Math.round(wasteRate * 10) / 10,
                        transportEfficiency: Math.round(transportEfficiency * 10) / 10,
                        sustainabilityScore: Math.round(sustainabilityScore * 10) / 10,
                        monthlyEfficiency,
                        divisionPerformance,
                        safetyScore: Math.round(safetyScore * 10) / 10
                    });
                }

            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Gagal memuat data dashboard';
                if (mounted) setError(msg);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [selectedEstate, dateRange, estates.length]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Dashboard Komprehensif</h1>
                    <p className="text-muted-foreground mt-1">
                        Selamat datang, {user?.name} - Analisis Produksi, Karyawan & Target
                    </p>
                </div>
                <div className="flex gap-2">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Pilih Periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">7 Hari</SelectItem>
                            <SelectItem value="month">Bulan Ini</SelectItem>
                            <SelectItem value="quarter">3 Bulan</SelectItem>
                            <SelectItem value="year">Tahun Ini</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={selectedEstate} onValueChange={setSelectedEstate}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Pilih Estate" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Estate</SelectItem>
                            {estates.map(e => (
                                <SelectItem key={e._id} value={e._id}>{e.estate_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="production">Produksi</TabsTrigger>
                    <TabsTrigger value="employees">Human Resource</TabsTrigger>
                    <TabsTrigger value="hse">HSE & Sustainability</TabsTrigger>
                </TabsList>

                {/* ============ OVERVIEW TAB ============ */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {loading ? (
                            [1, 2, 3, 4].map((i) => (
                                <Card key={i}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <Skeleton className="h-4 w-[120px]" />
                                        <Skeleton className="h-4 w-4 rounded-full" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-[100px] mb-2" />
                                        <Skeleton className="h-3 w-[80px]" />
                                    </CardContent>
                                </Card>
                            ))
                        ) : error ? (
                            <Card className="col-span-4">
                                <CardContent className="pt-6">
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        ) : stats ? (
                            [
                                { title: 'Total Karyawan', value: String(stats.totalEmployees), icon: Users, color: 'text-blue-500' },
                                { title: 'Laporan Hari Ini', value: String(stats.todayReports), icon: FileText, color: 'text-green-500' },
                                { title: 'Menunggu Verifikasi', value: String(stats.pendingCount), icon: CheckCircle, color: 'text-orange-500' },
                                { title: 'Target Bulan Ini', value: `${stats.targetsPercent}%`, icon: Target, color: 'text-purple-500' },
                            ].map((stat) => (
                                <Card key={stat.title}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stat.value}</div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : null}
                    </div>

                    {/* Production Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Tren Produksi (Taksasi vs Realisasi)</CardTitle>
                            <CardDescription>Perbandingan taksasi dan realisasi panen</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="Taksasi" fill="#8884d8" />
                                    <Bar dataKey="Realisasi" fill="#82ca9d" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============ PRODUCTION TAB ============ */}
                <TabsContent value="production" className="space-y-4">
                    {/* Production KPIs */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Taksasi</CardTitle>
                                <Activity className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{productionData.totalTaksasi.toLocaleString()} kg</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Panen</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{productionData.totalPanen.toLocaleString()} kg</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Angkut</CardTitle>
                                <Activity className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{productionData.totalAngkut.toLocaleString()} kg</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Efisiensi</CardTitle>
                                <Award className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{productionData.efficiencyRate}%</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Rata-rata AKP</CardTitle>
                                <Activity className="h-4 w-4 text-cyan-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{productionData.avgAKP}%</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Production Charts */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {productionData.monthlyProduction.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Tren Produksi Bulanan</CardTitle>
                                    <CardDescription>Taksasi, Panen & Angkut per Bulan</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={productionData.monthlyProduction}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="taksasi" stroke="#8884d8" strokeWidth={2} />
                                            <Line type="monotone" dataKey="panen" stroke="#82ca9d" strokeWidth={2} />
                                            <Line type="monotone" dataKey="angkut" stroke="#ffc658" strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Produksi per Divisi</CardTitle>
                                <CardDescription>Taksasi vs Panen per Divisi</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={productionData.divisionProduction}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="division" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="taksasi" fill="#8884d8" />
                                        <Bar dataKey="panen" fill="#82ca9d" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Performa Top 10 Blok</CardTitle>
                                <CardDescription>Ranking blok berdasarkan produksi dan efisiensi</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={productionData.blockPerformance}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="block" />
                                        <YAxis yAxisId="left" />
                                        <YAxis yAxisId="right" orientation="right" />
                                        <Tooltip />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="taksasi" fill="#8884d8" name="Taksasi (kg)" />
                                        <Bar yAxisId="left" dataKey="panen" fill="#82ca9d" name="Panen (kg)" />
                                        <Bar yAxisId="right" dataKey="efficiency" fill="#ffc658" name="Efisiensi (%)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ============ EMPLOYEES TAB ============ */}
                <TabsContent value="employees" className="space-y-4">
                    {/* Employee KPIs */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Karyawan</CardTitle>
                                <Users className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{employeeData.totalEmployees}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Karyawan Aktif</CardTitle>
                                <Users className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{employeeData.activeEmployees}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Karyawan Tidak Aktif</CardTitle>
                                <Users className="h-4 w-4 text-gray-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{employeeData.inactiveEmployees}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Employee Charts */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Distribusi Perusahaan</CardTitle>
                                <CardDescription>Jumlah karyawan per perusahaan</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={employeeData.companyDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {employeeData.companyDistribution.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Distribusi Posisi</CardTitle>
                                <CardDescription>Jumlah karyawan per posisi</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={employeeData.positionDistribution}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#82ca9d" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Distribusi Gender</CardTitle>
                                <CardDescription>Perbandingan gender karyawan</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={employeeData.genderDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, value }) => `${name}: ${value}`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {employeeData.genderDistribution.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ============ TARGETS TAB ============ */}
                <TabsContent value="hse" className="space-y-4">
                    {/* HSE KPIs */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Efisiensi Panen</CardTitle>
                                <Award className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{productionData.efficiencyRate}%</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {productionData.efficiencyRate >= 90 ? '✓ Sangat Baik' : 
                                     productionData.efficiencyRate >= 80 ? '○ Baik' : 
                                     '⚠ Perlu Ditingkatkan'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Waste Rate</CardTitle>
                                <Activity className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{hseData.wasteRate}%</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {hseData.wasteRate <= 10 ? '✓ Rendah' : 
                                     hseData.wasteRate <= 20 ? '○ Sedang' : 
                                     '⚠ Tinggi'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Efisiensi Transport</CardTitle>
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{hseData.transportEfficiency}%</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Angkut vs Panen
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Sustainability Score</CardTitle>
                                <Award className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{hseData.sustainabilityScore}%</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Skor Keberlanjutan
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* HSE Charts */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {hseData.monthlyEfficiency.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Tren Efisiensi & Waste Bulanan</CardTitle>
                                    <CardDescription>Perbandingan efisiensi dan waste rate per bulan</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={hseData.monthlyEfficiency}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="efficiency" stroke="#82ca9d" strokeWidth={2} name="Efisiensi (%)" />
                                            <Line type="monotone" dataKey="waste" stroke="#ff8042" strokeWidth={2} name="Waste (%)" />
                                            <Line type="monotone" dataKey="akp" stroke="#8884d8" strokeWidth={2} name="AKP (%)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Performa Efisiensi per Divisi</CardTitle>
                                <CardDescription>Efisiensi panen per divisi</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={hseData.divisionPerformance}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="division" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="efficiency" fill="#82ca9d" name="Efisiensi (%)">
                                            {hseData.divisionPerformance.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={entry.efficiency >= 90 ? '#82ca9d' : entry.efficiency >= 80 ? '#ffc658' : '#ff8042'} 
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Kualitas AKP per Divisi</CardTitle>
                                <CardDescription>Rata-rata AKP per divisi</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={hseData.divisionPerformance}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="division" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="akp" fill="#8884d8" name="AKP (%)">
                                            {hseData.divisionPerformance.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={entry.akp >= 85 ? '#82ca9d' : entry.akp >= 70 ? '#ffc658' : '#ff8042'} 
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Indikator Kualitas & Keamanan</CardTitle>
                                <CardDescription>KPI utama HSE & Sustainability</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">AKP (Kualitas Panen)</span>
                                            <span className="text-sm font-bold">{productionData.avgAKP}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className={`h-2.5 rounded-full ${
                                                    productionData.avgAKP >= 85 ? 'bg-green-500' : 
                                                    productionData.avgAKP >= 70 ? 'bg-yellow-500' : 
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(productionData.avgAKP, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">Efisiensi Panen</span>
                                            <span className="text-sm font-bold">{productionData.efficiencyRate}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className={`h-2.5 rounded-full ${
                                                    productionData.efficiencyRate >= 90 ? 'bg-green-500' : 
                                                    productionData.efficiencyRate >= 80 ? 'bg-yellow-500' : 
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(productionData.efficiencyRate, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">Transport Efficiency</span>
                                            <span className="text-sm font-bold">{hseData.transportEfficiency}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className={`h-2.5 rounded-full ${
                                                    hseData.transportEfficiency >= 95 ? 'bg-green-500' : 
                                                    hseData.transportEfficiency >= 85 ? 'bg-yellow-500' : 
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(hseData.transportEfficiency, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">Sustainability Score</span>
                                            <span className="text-sm font-bold">{hseData.sustainabilityScore}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className={`h-2.5 rounded-full ${
                                                    hseData.sustainabilityScore >= 85 ? 'bg-green-500' : 
                                                    hseData.sustainabilityScore >= 70 ? 'bg-yellow-500' : 
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(hseData.sustainabilityScore, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* HSE Insights */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Insight & Rekomendasi</CardTitle>
                            <CardDescription>Analisis kondisi HSE & Sustainability</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {productionData.efficiencyRate < 80 && (
                                    <Alert>
                                        <AlertDescription>
                                            <strong>⚠ Perhatian:</strong> Efisiensi panen di bawah 80% ({productionData.efficiencyRate}%). 
                                            Perlu peningkatan kualitas taksasi dan pemanenan.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                
                                {hseData.wasteRate > 20 && (
                                    <Alert>
                                        <AlertDescription>
                                            <strong>⚠ Waste Tinggi:</strong> Waste rate mencapai {hseData.wasteRate}%. 
                                            Evaluasi proses panen untuk mengurangi kehilangan buah.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {productionData.avgAKP < 70 && (
                                    <Alert>
                                        <AlertDescription>
                                            <strong>⚠ Kualitas AKP Rendah:</strong> Rata-rata AKP {productionData.avgAKP}%. 
                                            Tingkatkan standar pemanenan untuk kualitas buah yang lebih baik.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {productionData.efficiencyRate >= 90 && hseData.wasteRate <= 10 && (
                                    <Alert className="border-green-500 bg-green-50">
                                        <AlertDescription className="text-green-800">
                                            <strong>✓ Excellent Performance:</strong> Efisiensi panen sangat baik ({productionData.efficiencyRate}%) 
                                            dengan waste rendah ({hseData.wasteRate}%). Pertahankan standar ini!
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {hseData.sustainabilityScore >= 85 && (
                                    <Alert className="border-blue-500 bg-blue-50">
                                        <AlertDescription className="text-blue-800">
                                            <strong>✓ Sustainability Baik:</strong> Skor keberlanjutan mencapai {hseData.sustainabilityScore}%. 
                                            Operasional berjalan dengan sustainable.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {!hseData.divisionPerformance.some(d => d.efficiency >= 90) && (
                                    <Alert>
                                        <AlertDescription>
                                            <strong>📊 Info:</strong> Belum ada divisi yang mencapai efisiensi 90%. 
                                            Review proses taksasi dan pemanenan diperlukan.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Detail Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detail Performa HSE per Divisi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Divisi</th>
                                            <th className="text-right p-2">Taksasi (kg)</th>
                                            <th className="text-right p-2">Panen (kg)</th>
                                            <th className="text-right p-2">Efisiensi (%)</th>
                                            <th className="text-right p-2">AKP (%)</th>
                                            <th className="text-center p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hseData.divisionPerformance.map((item, idx) => (
                                            <tr key={idx} className="border-b hover:bg-gray-50">
                                                <td className="p-2 font-medium">{item.division}</td>
                                                <td className="text-right p-2">{item.taksasi.toLocaleString()}</td>
                                                <td className="text-right p-2">{item.panen.toLocaleString()}</td>
                                                <td className={`text-right p-2 font-bold ${
                                                    item.efficiency >= 90 ? 'text-green-600' : 
                                                    item.efficiency >= 80 ? 'text-yellow-600' : 
                                                    'text-red-600'
                                                }`}>
                                                    {item.efficiency}%
                                                </td>
                                                <td className={`text-right p-2 font-bold ${
                                                    item.akp >= 85 ? 'text-green-600' : 
                                                    item.akp >= 70 ? 'text-yellow-600' : 
                                                    'text-red-600'
                                                }`}>
                                                    {item.akp}%
                                                </td>
                                                <td className="text-center p-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                        item.efficiency >= 90 && item.akp >= 85 ? 'bg-green-100 text-green-800' : 
                                                        item.efficiency >= 80 && item.akp >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {item.efficiency >= 90 && item.akp >= 85 ? '✓ Excellent' : 
                                                         item.efficiency >= 80 && item.akp >= 70 ? '○ Good' : 
                                                         '⚠ Need Improvement'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 font-bold">
                                            <td className="p-2">TOTAL / RATA-RATA</td>
                                            <td className="text-right p-2">
                                                {hseData.divisionPerformance.reduce((sum, d) => sum + d.taksasi, 0).toLocaleString()}
                                            </td>
                                            <td className="text-right p-2">
                                                {hseData.divisionPerformance.reduce((sum, d) => sum + d.panen, 0).toLocaleString()}
                                            </td>
                                            <td className="text-right p-2">
                                                {hseData.divisionPerformance.length > 0 
                                                    ? Math.round(hseData.divisionPerformance.reduce((sum, d) => sum + d.efficiency, 0) / hseData.divisionPerformance.length * 10) / 10
                                                    : 0}%
                                            </td>
                                            <td className="text-right p-2">
                                                {hseData.divisionPerformance.length > 0 
                                                    ? Math.round(hseData.divisionPerformance.reduce((sum, d) => sum + d.akp, 0) / hseData.divisionPerformance.length * 10) / 10
                                                    : 0}%
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Dashboard;
