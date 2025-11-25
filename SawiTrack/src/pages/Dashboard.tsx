import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, CheckCircle, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    const [chartData, setChartData] = useState<any[]>([]);
    const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
    const [selectedEstate, setSelectedEstate] = useState<string>("all");

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

                // Fetch stats with estate filter
                const filterParams = selectedEstate !== "all" ? { estateId: selectedEstate } : {};
                const statsData = await api.stats(filterParams);
                if (mounted) setStats(statsData);

                // Fetch chart data for current month
                const now = new Date();
                const start = format(startOfMonth(now), 'yyyy-MM-dd');
                const end = format(endOfMonth(now), 'yyyy-MM-dd');

                const [taksasi, panen] = await Promise.all([
                    api.taksasiList({ startDate: start, endDate: end, ...filterParams }),
                    api.panenList({ startDate: start, endDate: end, ...filterParams })
                ]);

                const days = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
                const data = days.map(day => {
                    const dayTotalTaksasi = taksasi
                        .filter(row => isSameDay(parseISO(row.date), day))
                        .reduce((sum, row) => sum + (row.weightKg || 0), 0);

                    const dayTotalPanen = panen
                        .filter(row => isSameDay(parseISO(row.date_panen), day))
                        .reduce((sum, row) => sum + (row.weightKg || 0), 0);

                    return {
                        date: format(day, 'd MMM', { locale: id }),
                        Taksasi: dayTotalTaksasi,
                        Realisasi: dayTotalPanen
                    };
                });

                if (mounted) setChartData(data);

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
    }, [selectedEstate]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Selamat datang, {user?.name}
                    </p>
                </div>
                <div className="w-[200px]">
                    <Select value={selectedEstate} onValueChange={setSelectedEstate}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Estate" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Estate</SelectItem>
                            {estates.map((estate) => (
                                <SelectItem key={estate._id} value={estate._id}>
                                    {estate.estate_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {loading ? (
                    [1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Memuat…</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">—</div>
                            </CardContent>
                        </Card>
                    ))
                ) : error ? (
                    <Card className="md:col-span-2 lg:col-span-4">
                        <CardHeader>
                            <CardTitle>Error</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-destructive">{error}</div>
                        </CardContent>
                    </Card>
                ) : stats ? (
                    [
                        { title: 'Total Karyawan', value: String(stats.totalEmployees), icon: Users, color: 'text-primary' },
                        { title: 'Laporan Hari Ini', value: String(stats.todayReports), icon: FileText, color: 'text-accent' },
                        { title: 'Menunggu Verifikasi', value: String(stats.pendingCount), icon: CheckCircle, color: 'text-muted-foreground' },
                        { title: 'Target Bulan Ini', value: `${stats.targetsPercent}%`, icon: Target, color: 'text-success' },
                    ].map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <Card key={stat.title}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                                    <Icon className={`h-4 w-4 ${stat.color}`} />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                </CardContent>
                            </Card>
                        );
                    })
                ) : null}
            </div>

            {/* Chart Section */}
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Perbandingan Taksasi vs Realisasi Panen (Bulan Ini)</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value} kg`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend />
                                <Bar dataKey="Taksasi" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Realisasi" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Aktivitas Terbaru</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-4 text-sm">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    <div className="flex-1">
                                        <p className="font-medium">Laporan harian disubmit</p>
                                        <p className="text-muted-foreground">Karyawan {i} - 2 jam yang lalu</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Target Pencapaian</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>APK Division</span>
                                    <span className="font-medium">75%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: '75%' }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>TPN Division</span>
                                    <span className="font-medium">90%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-success" style={{ width: '90%' }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Pemanenan</span>
                                    <span className="font-medium">60%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-accent" style={{ width: '60%' }} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;