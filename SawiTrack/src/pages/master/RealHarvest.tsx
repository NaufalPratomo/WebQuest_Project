import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type DailyReport, type Employee, type User } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HK_RATE = 128869.24;

const RealHarvest = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Filters
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [reports, setReports] = useState<DailyReport[]>([]);

    // Master data
    const [employees, setEmployees] = useState<Employee[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (user && (user.role === 'staff' || user.role === 'non-staff')) {
            fetchMasterData();
        }
    }, [user]);

    useEffect(() => {
        fetchReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);

    const fetchMasterData = async () => {
        try {
            const [empRes, userRes] = await Promise.all([
                api.employees(),
                api.users()
            ]);
            setEmployees(empRes);
            setUsers(userRes);
        } catch (e) {
            console.error("Master data error", e);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await api.dailyReports({ date });
            setReports(res);
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Gagal memuat laporan", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        const newRow: DailyReport = {
            _id: `temp_${Date.now()}`,
            date,
            pt: 'HJA',
            division: 'Liyodu',
            nik: '',
            employeeName: '',
            mandorName: user?.role === 'non-staff' ? user.name : '',
            coa: '',
            activity: 'Panen Tahun Tanam 2016',
            jobType: '',
            block: '',
            yearPlanted: '2016',
            location: 'UYODU',
            hk: 1,
            hkPrice: HK_RATE,
            premi: 0,
            hkPremi: 0,
            rpPremi: 0,
            unit: 'Janjang',
            result: 0,
            janjang: 0,
            materialName: '',
            materialQty: 0,
            materialUnit: '',
        };
        setReports(prev => [newRow, ...prev]);
    };

    const handleUpdateRow = (id: string, field: keyof DailyReport, value: any) => {
        setReports(prev => prev.map(r => {
            if (r._id === id) {
                const updated = { ...r, [field]: value };

                if (field === 'hk') {
                    updated.hkPrice = (Number(value) || 0) * HK_RATE;
                }
                if (field === 'hkPremi') {
                    updated.rpPremi = (Number(value) || 0) * HK_RATE;
                }

                if (field === 'employeeName') {
                    const emp = employees.find(e => e.name === value);
                    if (emp) {
                        updated.nik = emp.nik;
                    }
                }

                return updated;
            }
            return r;
        }));
    };

    const handleSaveRow = async (row: DailyReport) => {
        try {
            // Validate required fields if needed
            if (!row.employeeName) return;

            if (row._id.startsWith('temp_')) {
                // Create
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _id, ...payload } = row;
                const created = await api.dailyReportCreate(payload as any);
                if (!Array.isArray(created)) {
                    setReports(prev => prev.map(r => r._id === row._id ? created : r));
                    toast({ description: "Berhasil disimpan" });
                }
            } else {
                // Update
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _id, ...payload } = row;
                await api.dailyReportUpdate(_id, payload);
                toast({ description: "Berhasil diperbarui" });
            }
        } catch (e: any) {
            toast({ title: "Gagal", description: e.message, variant: "destructive" });
        }
    };

    const handleDeleteRow = async (id: string) => {
        if (id.startsWith('temp_')) {
            setReports(prev => prev.filter(r => r._id !== id));
            return;
        }
        if (!confirm("Hapus baris ini?")) return;
        try {
            await api.dailyReportDelete(id);
            setReports(prev => prev.filter(r => r._id !== id));
            toast({ description: "Terhapus" });
        } catch (e: any) {
            toast({ description: e.message, variant: "destructive" });
        }
    };

    const renderCell = (row: DailyReport, field: keyof DailyReport, type: 'text' | 'number' = 'text', width = 'w-24') => {
        return (
            <Input
                className={`h-8 border-transparent focus:border-input bg-transparent px-1 min-w-[60px] ${width}`}
                value={row[field] as string | number || ''}
                onChange={e => handleUpdateRow(row._id, field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                onBlur={() => {
                    if (!row._id.startsWith('temp_')) handleSaveRow(row);
                }}
            />
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Realisasi</h1>
                    <p className="text-xs text-muted-foreground">Detail payroll dan laporan harian mandor</p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-40"
                    />
                    <Button onClick={handleAddRow} size="sm"><Plus className="h-4 w-4 mr-1" /> Baris</Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="w-full overflow-auto max-h-[75vh]">
                        <Table className="w-max min-w-full border-collapse text-xs">
                            <TableHeader className="bg-orange-500 text-white sticky top-0 z-20">
                                <TableRow>
                                    <TableHead rowSpan={2} className="border border-orange-600 bg-green-200 text-black font-semibold text-center align-middle h-auto p-2 min-w-[60px]">PT</TableHead>
                                    <TableHead rowSpan={2} className="border border-orange-600 bg-green-200 text-black font-semibold text-center align-middle h-auto p-2 min-w-[80px]">DIVISI</TableHead>

                                    <TableHead className="text-white border border-gray-600 bg-gray-700 text-center py-2 text-sm font-bold" colSpan={4}>PAYROLL</TableHead>
                                    <TableHead className="text-white border border-gray-600 bg-gray-700 text-center py-2 text-sm font-bold" colSpan={17}>LAPORAN HARIAN</TableHead>

                                    <TableHead rowSpan={2} className="bg-gray-800 border border-gray-900 border-l border-r text-white text-center align-middle min-w-[70px]">Aksi</TableHead>
                                </TableRow>
                                <TableRow className="bg-zinc-100 text-black">
                                    <TableHead className="border font-semibold min-w-[100px] bg-green-200 text-center align-middle">Tanggal</TableHead>
                                    <TableHead className="border font-semibold min-w-[120px] bg-orange-200 text-center align-middle">NIK</TableHead>
                                    <TableHead className="border font-semibold min-w-[200px] bg-orange-200 text-center align-middle">Nama Karyawan</TableHead>
                                    <TableHead className="border font-semibold min-w-[150px] bg-orange-200 text-center align-middle">Mandoran</TableHead>

                                    <TableHead className="border font-semibold min-w-[100px] bg-green-200 text-center align-middle">No COA</TableHead>
                                    <TableHead className="border font-semibold min-w-[200px] bg-green-200 text-center align-middle">Aktivitas</TableHead>
                                    <TableHead className="border font-semibold min-w-[200px] bg-green-200 text-center align-middle">Jenis Pekerjaan</TableHead>
                                    <TableHead className="border font-semibold min-w-[60px] bg-green-200 text-center align-middle">Batch/Blok</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-green-200 text-center align-middle">Tahun Tanam</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-green-200 text-center align-middle">Lokasi</TableHead>

                                    <TableHead className="border font-semibold min-w-[50px] bg-green-200 text-center align-middle">HK</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-green-200 text-center align-middle">Rp HK</TableHead>
                                    <TableHead className="border font-semibold min-w-[80px] bg-green-200 text-center align-middle">Premi</TableHead>
                                    <TableHead className="border font-semibold min-w-[50px] bg-green-200 text-center align-middle">HK Premi</TableHead>
                                    <TableHead className="border font-semibold min-w-[100px] bg-green-200 text-center align-middle">Rp Premi</TableHead>

                                    <TableHead className="border font-semibold min-w-[80px] bg-green-200 text-center align-middle">Satuan</TableHead>
                                    <TableHead className="border font-semibold min-w-[80px] bg-green-200 text-center align-middle">Hasil Kerja</TableHead>
                                    <TableHead className="border font-semibold min-w-[60px] bg-green-200 text-center align-middle">Janjang</TableHead>

                                    <TableHead className="border font-semibold min-w-[150px] bg-green-200 text-center align-middle">Nama Bahan</TableHead>
                                    <TableHead className="border font-semibold min-w-[80px] bg-green-200 text-center align-middle">Jumlah Bahan</TableHead>
                                    <TableHead className="border font-semibold min-w-[80px] bg-green-200 text-center align-middle">Satuan Bahan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && <TableRow><TableCell colSpan={24} className="text-center h-20"><Loader2 className="animate-spin inline mr-2" /> Loading...</TableCell></TableRow>}
                                {reports.map((row) => (
                                    <TableRow key={row._id} className="hover:bg-muted/30">
                                        <TableCell className="border p-0">{renderCell(row, 'pt', 'text', 'w-16')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'division', 'text', 'w-20')}</TableCell>
                                        <TableCell className="border p-0 bg-muted/20 text-center">{date}</TableCell>
                                        <TableCell className="border p-0"><Input value={row.nik || ''} readOnly className="h-8 border-transparent bg-transparent" /></TableCell>

                                        <TableCell className="border p-0 relative group">
                                            <div className="relative">
                                                <Input
                                                    className="h-8 border-transparent bg-transparent"
                                                    value={row.employeeName}
                                                    onChange={e => handleUpdateRow(row._id, 'employeeName', e.target.value)}
                                                    list={`emps-${row._id}`}
                                                    placeholder="Ketik Nama..."
                                                    onBlur={() => { if (!row._id.startsWith('temp_')) handleSaveRow(row); }}
                                                />
                                                <datalist id={`emps-${row._id}`}>
                                                    {employees.map(e => <option key={e._id} value={e.name} />)}
                                                </datalist>
                                            </div>
                                        </TableCell>

                                        <TableCell className="border p-0">{renderCell(row, 'mandorName', 'text', 'w-32')}</TableCell>

                                        <TableCell className="border p-0">{renderCell(row, 'coa', 'text', 'w-24')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'activity', 'text', 'w-48')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'jobType', 'text', 'w-40')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'block', 'text', 'w-16')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'yearPlanted', 'text', 'w-16')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'location', 'text', 'w-24')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'hk', 'number', 'w-12')}</TableCell>
                                        <TableCell className="border p-0 bg-muted/20 text-right px-2">
                                            {row.hkPrice?.toLocaleString('id-ID')}
                                        </TableCell>

                                        <TableCell className="border p-0">{renderCell(row, 'premi', 'number', 'w-16')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'hkPremi', 'number', 'w-12')}</TableCell>
                                        <TableCell className="border p-0 bg-muted/20 text-right px-2">
                                            {row.rpPremi?.toLocaleString('id-ID')}
                                        </TableCell>

                                        <TableCell className="border p-0">{renderCell(row, 'unit', 'text', 'w-16')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'result', 'number', 'w-16')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'janjang', 'number', 'w-16')}</TableCell>

                                        <TableCell className="border p-0">{renderCell(row, 'materialName', 'text', 'w-32')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'materialQty', 'number', 'w-16')}</TableCell>
                                        <TableCell className="border p-0">{renderCell(row, 'materialUnit', 'text', 'w-16')}</TableCell>

                                        <TableCell className="p-1 text-center border-l flex justify-center gap-1">
                                            {row._id.startsWith('temp_') ? (
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600" onClick={() => handleSaveRow(row)}>
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                            ) : null}
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(row._id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <style>{`
                /* Hide number spinners */
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
            `}</style>
        </div>
    );
};

export default RealHarvest;
