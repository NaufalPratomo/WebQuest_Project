import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type DailyReport } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const InputDailyReport = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Filter berdasarkan bulan dan tahun
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth() + 1).padStart(2, '0'));
    const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));
    const [reports, setReports] = useState<DailyReport[]>([]);

    useEffect(() => {
        fetchMonthlyReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear]);

    const fetchMonthlyReports = async () => {
        setLoading(true);
        try {
            // Menentukan range tanggal untuk bulan yang dipilih
            const startDate = `${selectedYear}-${selectedMonth}-01`;
            const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
            const endDate = `${selectedYear}-${selectedMonth}-${lastDay}`;

            const res = await api.dailyReports({ startDate, endDate });
            setReports(res);
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Gagal memuat laporan bulanan", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Aggregasi data per karyawan untuk bulan tersebut
    const aggregatedData = useMemo(() => {
        const grouped: Record<string, {
            nik: string;
            employeeName: string;
            mandorName: string;
            pt: string;
            division: string;
            totalHK: number;
            totalHKPrice: number;
            totalPremi: number;
            totalHKPremi: number;
            totalRpPremi: number;
            totalResult: number;
            totalJanjang: number;
            workDays: number;
        }> = {};

        reports.forEach(r => {
            const key = r.nik || r.employeeName;
            if (!grouped[key]) {
                grouped[key] = {
                    nik: r.nik || '',
                    employeeName: r.employeeName,
                    mandorName: r.mandorName || '',
                    pt: r.pt || '',
                    division: r.division || '',
                    totalHK: 0,
                    totalHKPrice: 0,
                    totalPremi: 0,
                    totalHKPremi: 0,
                    totalRpPremi: 0,
                    totalResult: 0,
                    totalJanjang: 0,
                    workDays: 0,
                };
            }

            grouped[key].totalHK += Number(r.hk) || 0;
            grouped[key].totalHKPrice += Number(r.hkPrice) || 0;
            grouped[key].totalPremi += Number(r.premi) || 0;
            grouped[key].totalHKPremi += Number(r.hkPremi) || 0;
            grouped[key].totalRpPremi += Number(r.rpPremi) || 0;
            grouped[key].totalResult += Number(r.result) || 0;
            grouped[key].totalJanjang += Number(r.janjang) || 0;
            grouped[key].workDays += 1;
        });

        return Object.values(grouped).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }, [reports]);

    // Grand totals
    const grandTotals = useMemo(() => {
        return aggregatedData.reduce((acc, row) => ({
            totalHK: acc.totalHK + row.totalHK,
            totalHKPrice: acc.totalHKPrice + row.totalHKPrice,
            totalPremi: acc.totalPremi + row.totalPremi,
            totalHKPremi: acc.totalHKPremi + row.totalHKPremi,
            totalRpPremi: acc.totalRpPremi + row.totalRpPremi,
            totalResult: acc.totalResult + row.totalResult,
            totalJanjang: acc.totalJanjang + row.totalJanjang,
            workDays: acc.workDays + row.workDays,
        }), {
            totalHK: 0,
            totalHKPrice: 0,
            totalPremi: 0,
            totalHKPremi: 0,
            totalRpPremi: 0,
            totalResult: 0,
            totalJanjang: 0,
            workDays: 0,
        });
    }, [aggregatedData]);

    const months = [
        { value: '01', label: 'Januari' },
        { value: '02', label: 'Februari' },
        { value: '03', label: 'Maret' },
        { value: '04', label: 'April' },
        { value: '05', label: 'Mei' },
        { value: '06', label: 'Juni' },
        { value: '07', label: 'Juli' },
        { value: '08', label: 'Agustus' },
        { value: '09', label: 'September' },
        { value: '10', label: 'Oktober' },
        { value: '11', label: 'November' },
        { value: '12', label: 'Desember' },
    ];

    const years = [];
    for (let y = currentDate.getFullYear(); y >= currentDate.getFullYear() - 5; y--) {
        years.push(String(y));
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Input Laporan Bulanan</h1>
                    <p className="text-xs text-muted-foreground">Rekap laporan per karyawan per bulan (data di-SUM)</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                    >
                        {months.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="w-full overflow-auto max-h-[75vh]">
                        <Table className="w-max min-w-full border-collapse text-xs">
                            <TableHeader className="bg-orange-500 text-white sticky top-0 z-20">
                                <TableRow>
                                    <TableHead className="border border-orange-600 bg-green-200 text-black font-semibold text-center align-middle h-auto p-2 min-w-[50px]">No</TableHead>
                                    <TableHead className="border border-orange-600 bg-green-200 text-black font-semibold text-center align-middle h-auto p-2 min-w-[60px]">PT</TableHead>
                                    <TableHead className="border border-orange-600 bg-green-200 text-black font-semibold text-center align-middle h-auto p-2 min-w-[80px]">Divisi</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-orange-200 text-black text-center align-middle">NIK</TableHead>
                                    <TableHead className="border font-semibold min-w-[200px] bg-orange-200 text-black text-center align-middle">Nama Karyawan</TableHead>
                                    <TableHead className="border font-semibold min-w-[150px] bg-orange-200 text-black text-center align-middle">Mandoran</TableHead>
                                    <TableHead className="border font-semibold min-w-[80px] bg-blue-200 text-black text-center align-middle">Hari Kerja</TableHead>
                                    <TableHead className="border font-semibold min-w-[80px] bg-green-200 text-black text-center align-middle">Total HK</TableHead>
                                    <TableHead className="border font-semibold min-w-[120px] bg-green-200 text-black text-center align-middle">Total Rp HK</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-yellow-200 text-black text-center align-middle">Total Premi</TableHead>
                                    <TableHead className="border font-semibold min-w-[80px] bg-yellow-200 text-black text-center align-middle">Total HK Premi</TableHead>
                                    <TableHead className="border font-semibold min-w-[120px] bg-yellow-200 text-black text-center align-middle">Total Rp Premi</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-purple-200 text-black text-center align-middle">Total Hasil Kerja</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-purple-200 text-black text-center align-middle">Total Janjang</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && (
                                    <TableRow>
                                        <TableCell colSpan={14} className="text-center h-20">
                                            <Loader2 className="animate-spin inline mr-2" /> Loading...
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!loading && aggregatedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={14} className="text-center h-20 text-muted-foreground">
                                            Tidak ada data di bulan ini
                                        </TableCell>
                                    </TableRow>
                                )}
                                {aggregatedData.map((row, idx) => (
                                    <TableRow key={row.nik || row.employeeName} className="hover:bg-muted/30">
                                        <TableCell className="border p-2 text-center">{idx + 1}</TableCell>
                                        <TableCell className="border p-2">{row.pt}</TableCell>
                                        <TableCell className="border p-2">{row.division}</TableCell>
                                        <TableCell className="border p-2">{row.nik}</TableCell>
                                        <TableCell className="border p-2 font-medium">{row.employeeName}</TableCell>
                                        <TableCell className="border p-2">{row.mandorName}</TableCell>
                                        <TableCell className="border p-2 text-center bg-blue-50">{row.workDays}</TableCell>
                                        <TableCell className="border p-2 text-right">{row.totalHK.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right bg-green-50">{row.totalHKPrice.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{row.totalPremi.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{row.totalHKPremi.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right bg-yellow-50">{row.totalRpPremi.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{row.totalResult.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{row.totalJanjang.toLocaleString('id-ID')}</TableCell>
                                    </TableRow>
                                ))}
                                {/* Footer dengan Grand Total */}
                                {!loading && aggregatedData.length > 0 && (
                                    <TableRow className="bg-gray-100 font-bold">
                                        <TableCell colSpan={6} className="border p-2 text-right font-bold">GRAND TOTAL</TableCell>
                                        <TableCell className="border p-2 text-center bg-blue-100">{grandTotals.workDays}</TableCell>
                                        <TableCell className="border p-2 text-right">{grandTotals.totalHK.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right bg-green-100">{grandTotals.totalHKPrice.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{grandTotals.totalPremi.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{grandTotals.totalHKPremi.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right bg-yellow-100">{grandTotals.totalRpPremi.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{grandTotals.totalResult.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="border p-2 text-right">{grandTotals.totalJanjang.toLocaleString('id-ID')}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground">
                <p>Data di-SUM dari semua laporan harian pada bulan {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</p>
                <p>Total Karyawan: {aggregatedData.length} | Total Entri: {reports.length}</p>
            </div>
        </div>
    );
};

export default InputDailyReport;
