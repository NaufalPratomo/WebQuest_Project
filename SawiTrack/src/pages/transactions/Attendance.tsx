import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api, type Employee, type User } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface AttendanceRecord {
    _id: string;
    date: string;
    employeeId: string;
    status: string;
    division_id?: number;
    notes?: string;
    hk?: number;
}

const Attendance = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));
    const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

    useEffect(() => {
        fetchMasterData();
    }, []);

    useEffect(() => {
        fetchAttendance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear]);

    const fetchMasterData = async () => {
        try {
            const [empData, userData] = await Promise.all([
                api.employees(),
                api.users()
            ]);
            setEmployees(empData);
            setUsers(userData);
        } catch (error) {
            console.error("Failed to fetch master data", error);
            toast({
                title: "Error",
                description: "Gagal memuat data master",
                variant: "destructive",
            });
        }
    };

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const year = parseInt(selectedYear);
            const month = parseInt(selectedMonth);

            const startDate = new Date(year, month, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

            const res = await api.attendanceList({ startDate, endDate } as any);
            setAttendanceData(res as any);

        } catch (error) {
            console.error("Failed to fetch attendance", error);
            toast({
                title: "Error",
                description: "Gagal memuat data absensi",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth));
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getMandorName = (mandorId?: string) => {
        if (!mandorId) return "-";
        const user = users.find(u => u._id === mandorId);
        return user ? user.name : "-";
    };

    const handleCellClick = async (employeeId: string, day: number) => {
        if (!user || (user.role !== 'foreman' && user.role !== 'manager')) return;
        if (loading || isUpdating) return;

        const dateObj = new Date(parseInt(selectedYear), parseInt(selectedMonth), day);
        // Adjust for timezone offset if necessary to strictly match local date string "YYYY-MM-DD"
        // Safe way: create date with year, month, day and get component values padded.
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        // Find existing attendance
        // We need to match date string accurately.
        // Our attendanceData usually has full ISO string "2025-12-01T00:00:00.000Z" coming from backend?
        // Let's verify how we compare in tableData logic: `new Date(a.date)`.
        // The `attendanceData` comes from `api.attendanceList`.

        // We search locally for the record
        const existingRecord = attendanceData.find(a => {
            const aDate = new Date(a.date);
            return a.employeeId === employeeId &&
                aDate.getDate() === day &&
                aDate.getMonth() === parseInt(selectedMonth) &&
                aDate.getFullYear() === parseInt(selectedYear);
        });

        setIsUpdating(true);
        try {
            if (existingRecord) {
                // Delete
                await api.attendanceDelete(existingRecord._id);
                setAttendanceData(prev => prev.filter(a => a._id !== existingRecord._id));
                toast({ description: "Status: Tidak Hadir", duration: 1500 });
            } else {
                // Create
                // We use simple "present" status for now as implied by "1"
                const res = await api.attendanceCreate({
                    date: dateStr,
                    employeeId,
                    status: 'present',
                    division_id: undefined, // Optional, can fetch from employee if needed
                    notes: ''
                });

                // Add to local state
                // Backend should return _id, we construct the object
                // Use dateStr or an ISO string? Backend usually expects ISO or YYYY-MM-DD.
                // If we send YYYY-MM-DD to `create`, assume it stores correctly.
                // We need to push an object that satisfies `AttendanceRecord`.
                // Let's try to match existing format.
                setAttendanceData(prev => [...prev, {
                    _id: res._id,
                    date: dateStr, // logic below parses this correctly as long as new Date(dateStr) works
                    employeeId,
                    status: 'present'
                }]);
                toast({ description: "Status: Hadir", duration: 1500 });
            }
        } catch (error) {
            console.error("Failed to update attendance", error);
            toast({
                title: "Gagal",
                description: error instanceof Error ? error.message : "Gagal mengupdate absensi",
                variant: "destructive"
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const tableData = useMemo(() => {
        return employees.map(emp => {
            const empAttendance = attendanceData.filter(a => a.employeeId === emp._id);

            const attendanceDays = new Set<number>();
            empAttendance.forEach(a => {
                const d = new Date(a.date);
                if (d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear)) {
                    attendanceDays.add(d.getDate());
                }
            });

            return {
                ...emp,
                mandorName: getMandorName(emp.mandorId),
                attendanceDays,
                totalPresence: attendanceDays.size
            };
        });
    }, [employees, attendanceData, selectedMonth, selectedYear, users]);

    const sortedData = [...tableData].sort((a, b) => {
        if (a.mandorName !== b.mandorName) return a.mandorName.localeCompare(b.mandorName);
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Absensi Harian</h1>
                    <p className="text-muted-foreground">Rekap kehadiran karyawan harian</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Pilih Bulan" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                    {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Tahun" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 3 }, (_, i) => String(currentYear - 1 + i)).map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={fetchAttendance} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-2">
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto border rounded-md max-h-[75vh]">
                        <Table className="w-max min-w-full border-collapse">
                            <TableHeader className="bg-muted sticky top-0 z-30 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[60px] border font-bold text-center bg-muted sticky left-0 z-30">PT</TableHead>
                                    <TableHead className="w-[80px] border font-bold text-center bg-muted sticky left-[60px] z-30">DIVISI</TableHead>
                                    <TableHead className="w-[150px] border font-bold text-center bg-muted sticky left-[140px] z-30">Mandoran</TableHead>
                                    <TableHead className="w-[200px] border font-bold text-center bg-muted sticky left-[290px] z-30 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Karyawan</TableHead>
                                    {daysArray.map(day => (
                                        <TableHead key={day} className="w-[35px] min-w-[35px] border text-center p-1 text-xs font-medium">
                                            {day}
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-[80px] border font-bold text-center bg-muted sticky right-0 z-30">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedData.map((row) => (
                                    <TableRow key={row._id} className="hover:bg-muted/10">
                                        <TableCell className="border text-center sticky left-0 bg-background z-20">PALMA</TableCell>
                                        <TableCell className="border text-center sticky left-[60px] bg-background z-20">{row.division || "-"}</TableCell>
                                        <TableCell className="border text-center font-medium sticky left-[140px] bg-background z-20 truncate max-w-[150px]">{row.mandorName}</TableCell>
                                        <TableCell className="border font-medium sticky left-[290px] bg-background z-20 whitespace-nowrap shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.name}</TableCell>
                                        {daysArray.map(day => (
                                            <TableCell
                                                key={day}
                                                className={`border text-center p-0 h-8 transition-colors ${(user?.role === 'foreman' || user?.role === 'manager')
                                                    ? "cursor-pointer hover:bg-muted/30"
                                                    : ""
                                                    }`}
                                                onClick={() => handleCellClick(row._id, day)}
                                            >
                                                {row.attendanceDays.has(day) ? (
                                                    <div className="flex items-center justify-center w-full h-full text-green-600 font-bold bg-green-50">1</div>
                                                ) : null}
                                            </TableCell>
                                        ))}
                                        <TableCell className="border text-center font-bold sticky right-0 bg-background z-20">{row.totalPresence}</TableCell>
                                    </TableRow>
                                ))}
                                {sortedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4 + daysArray.length + 1} className="text-center py-8 text-muted-foreground">
                                            Tidak ada data untuk periode ini
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Attendance;
