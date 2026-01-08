import { useState, useEffect, useMemo, useCallback } from "react";
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
    division_id?: number | string;
    notes?: string;
    hk?: number;
}

function formatHK(value: number): string {
    // Show decimals using Indonesian comma, omit trailing ,0
    const rounded = Math.round(value * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded
        .toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        .replace(/,00$/, "");
}

function formatHeaderDate(year: number, month: number, day: number): string {
    const dd = String(day).padStart(2, "0");
    const mm = String(month + 1).padStart(2, "0");
    const yy = String(year).slice(-2);
    return `${dd}/${mm}/${yy}`;
}

const Attendance = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Array<{ _id: string; company_name: string }>>([]);
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));
    const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

    const fetchMasterData = useCallback(async () => {
        try {
            const [empData, userData, companyData] = await Promise.all([
                api.employees(),
                api.users(),
                api.companies(),
            ]);
            setEmployees(empData);
            setUsers(userData);
            setCompanies((companyData || []).map((c) => ({ _id: c._id, company_name: c.company_name })));
        } catch (error) {
            console.error("Failed to fetch master data", error);
            toast({
                title: "Error",
                description: "Gagal memuat data master",
                variant: "destructive",
            });
        }
    }, [toast]);

    useEffect(() => {
        fetchMasterData();
    }, [fetchMasterData]);

    useEffect(() => {
        fetchAttendance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const year = parseInt(selectedYear);
            const month = parseInt(selectedMonth);

            const mm = String(month + 1).padStart(2, "0");
            const lastDay = new Date(year, month + 1, 0).getDate();
            const startDate = `${year}-${mm}-01`;
            const endDate = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

            const res = await api.attendanceList({ startDate, endDate });
            setAttendanceData(res);

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

    const getMandorName = useCallback((mandorId?: string) => {
        if (!mandorId) return "-";
        const user = users.find(u => u._id === mandorId);
        return user ? user.name : "-";
    }, [users]);

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
                const emp = employees.find(e => e._id === employeeId);
                const res = await api.attendanceCreate({
                    date: dateStr,
                    employeeId,
                    status: 'present',
                    division_id: emp?.division, // Pass employee's division string/number
                    notes: ''
                });

                // Add to local state
                setAttendanceData(prev => [...prev, {
                    _id: res._id,
                    date: dateStr,
                    employeeId,
                    status: 'present',
                    division_id: emp?.division
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
        const month = parseInt(selectedMonth);
        const year = parseInt(selectedYear);

        const companyNameById = new Map(companies.map((c) => [c._id, c.company_name]));

        const visibleEmployees = employees.filter((emp) => {
            const pos = (emp.position || "").toLowerCase();
            return pos !== "mandor";
        });

        return visibleEmployees.map(emp => {
            const empAttendance = attendanceData.filter(a => a.employeeId === emp._id);

            const attendanceByDay = new Map<number, number>();
            empAttendance.forEach(a => {
                const d = new Date(a.date);
                if (d.getMonth() === month && d.getFullYear() === year) {
                    const hk = typeof a.hk === "number" ? a.hk : 1;
                    attendanceByDay.set(d.getDate(), hk);
                }
            });

            const totalHK = Array.from(attendanceByDay.values()).reduce((sum, v) => sum + v, 0);

            const ptName = emp.companyId ? (companyNameById.get(emp.companyId) || "") : "";

            return {
                ...emp,
                pt: ptName,
                mandorName: getMandorName(emp.mandorId),
                attendanceByDay,
                totalHK
            };
        });
    }, [employees, attendanceData, selectedMonth, selectedYear, getMandorName, companies]);

    const sortedData = [...tableData].sort((a, b) => {
        const aPT = a.pt || "";
        const bPT = b.pt || "";
        if (aPT !== bPT) return aPT.localeCompare(bPT);

        const aDiv = a.division || "";
        const bDiv = b.division || "";
        if (aDiv !== bDiv) return aDiv.localeCompare(bDiv);

        const aMandor = a.mandorName || "";
        const bMandor = b.mandorName || "";
        if (aMandor !== bMandor) return aMandor.localeCompare(bMandor);

        return a.name.localeCompare(b.name);
    });

    type RenderRow =
        | {
            kind: "employee";
            row: (typeof sortedData)[number];
            showPT: boolean;
            showDivision: boolean;
            showMandor: boolean;
            ptRowSpan: number;
            divisionRowSpan: number;
            mandorRowSpan: number;
        }
        | {
            kind: "mandorTotal";
            label: string;
            totalsByDay: Map<number, number>;
            totalHK: number;
        }
        | {
            kind: "divisionTotal";
            label: string;
            totalsByDay: Map<number, number>;
            totalHK: number;
        }
        | {
            kind: "ptTotal";
            label: string;
            totalsByDay: Map<number, number>;
            totalHK: number;
        }
        | {
            kind: "grandTotal";
            label: string;
            totalsByDay: Map<number, number>;
            totalHK: number;
        };

    const renderRows: RenderRow[] = useMemo(() => {
        const makeTotals = () => new Map<number, number>();
        const addToTotals = (totals: Map<number, number>, byDay: Map<number, number>) => {
            for (const [day, hk] of byDay.entries()) {
                totals.set(day, (totals.get(day) || 0) + hk);
            }
        };

        // Group employees by PT -> Divisi -> Mandor
        const ptKeys = [...new Set(sortedData.map((r) => r.pt || ""))].sort((a, b) => a.localeCompare(b));

        const rows: RenderRow[] = [];
        const grandTotals = makeTotals();
        let grandTotalHK = 0;

        for (const pt of ptKeys) {
            const ptEmployees = sortedData.filter((r) => (r.pt || "") === pt);
            if (ptEmployees.length === 0) continue;

            const divisionKeys = [...new Set(ptEmployees.map((r) => r.division || ""))].sort((a, b) => a.localeCompare(b));

            // Precompute PT span (rows to be merged for PT cell):
            // all employee rows + mandor totals + division totals (excluding PT total row)
            let ptSpan = 0;
            for (const div of divisionKeys) {
                const divEmployees = ptEmployees.filter((r) => (r.division || "") === div);
                const mandorKeys = [...new Set(divEmployees.map((r) => r.mandorName || ""))];
                ptSpan += divEmployees.length; // employees
                ptSpan += mandorKeys.length; // mandor total rows
                ptSpan += 1; // division total row
            }

            const ptTotals = makeTotals();
            let ptTotalHK = 0;
            let ptCellRendered = false;

            for (const div of divisionKeys) {
                const divEmployeesAll = ptEmployees
                    .filter((r) => (r.division || "") === div)
                    .sort((a, b) => (a.mandorName || "").localeCompare(b.mandorName || "") || a.name.localeCompare(b.name));
                if (divEmployeesAll.length === 0) continue;

                const mandorKeys = [...new Set(divEmployeesAll.map((r) => r.mandorName || ""))].sort((a, b) => a.localeCompare(b));

                // Division span merged for DIVISI cell: employees + mandor totals (excluding division total row)
                const divisionSpan = divEmployeesAll.length + mandorKeys.length;
                let divisionCellRendered = false;

                const divisionTotals = makeTotals();
                let divisionTotalHK = 0;

                for (const mandor of mandorKeys) {
                    const mandorEmployees = divEmployeesAll.filter((r) => (r.mandorName || "") === mandor);
                    if (mandorEmployees.length === 0) continue;

                    const mandorTotals = makeTotals();
                    let mandorTotalHK = 0;

                    for (let i = 0; i < mandorEmployees.length; i++) {
                        const emp = mandorEmployees[i];
                        const showMandor = i === 0;
                        const showDivision = !divisionCellRendered;
                        const showPT = !ptCellRendered;

                        rows.push({
                            kind: "employee",
                            row: emp,
                            showPT,
                            showDivision,
                            showMandor,
                            ptRowSpan: showPT ? ptSpan : 0,
                            divisionRowSpan: showDivision ? divisionSpan : 0,
                            mandorRowSpan: showMandor ? mandorEmployees.length : 0,
                        });

                        ptCellRendered = true;
                        divisionCellRendered = true;

                        addToTotals(mandorTotals, emp.attendanceByDay);
                        mandorTotalHK += emp.totalHK;

                        addToTotals(divisionTotals, emp.attendanceByDay);
                        divisionTotalHK += emp.totalHK;

                        addToTotals(ptTotals, emp.attendanceByDay);
                        ptTotalHK += emp.totalHK;

                        addToTotals(grandTotals, emp.attendanceByDay);
                        grandTotalHK += emp.totalHK;
                    }

                    // Mandor Total row (label in Mandoran column)
                    rows.push({
                        kind: "mandorTotal",
                        label: `${mandor} Total`,
                        totalsByDay: mandorTotals,
                        totalHK: mandorTotalHK,
                    });
                }

                // Division Total row (label in DIVISI column)
                rows.push({
                    kind: "divisionTotal",
                    label: `${div} Total`,
                    totalsByDay: divisionTotals,
                    totalHK: divisionTotalHK,
                });
            }

            // PT Total row (label in PT column)
            rows.push({
                kind: "ptTotal",
                label: `${pt} Total`,
                totalsByDay: ptTotals,
                totalHK: ptTotalHK,
            });
        }

        if (rows.length > 0) {
            rows.push({
                kind: "grandTotal",
                label: "Grand Total",
                totalsByDay: grandTotals,
                totalHK: grandTotalHK,
            });
        }

        return rows;
    }, [sortedData]);

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
                                            {formatHeaderDate(parseInt(selectedYear), parseInt(selectedMonth), day)}
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-[80px] border font-bold text-center bg-muted sticky right-0 z-30">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {renderRows.map((item, idx) => {
                                    if (item.kind === "employee") {
                                        const row = item.row;
                                        return (
                                            <TableRow key={row._id} className="hover:bg-muted/10">
                                                {item.showPT ? (
                                                    <TableCell
                                                        rowSpan={item.ptRowSpan}
                                                        className="border text-center sticky left-0 bg-background z-20 align-middle"
                                                    >
                                                        {row.pt || "-"}
                                                    </TableCell>
                                                ) : null}

                                                {item.showDivision ? (
                                                    <TableCell
                                                        rowSpan={item.divisionRowSpan}
                                                        className="border text-center sticky left-[60px] bg-background z-20 align-middle"
                                                    >
                                                        {/^\d+$/.test(row.division || "")
                                                            ? `Divisi ${row.division}`
                                                            : row.division || "-"}
                                                    </TableCell>
                                                ) : null}

                                                {item.showMandor ? (
                                                    <TableCell
                                                        rowSpan={item.mandorRowSpan}
                                                        className="border text-center font-medium sticky left-[140px] bg-background z-20 truncate max-w-[150px] align-middle"
                                                    >
                                                        {row.mandorName}
                                                    </TableCell>
                                                ) : null}
                                                <TableCell className="border font-medium sticky left-[290px] bg-background z-20 whitespace-nowrap shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.name}</TableCell>
                                                {daysArray.map(day => {
                                                    const hk = row.attendanceByDay.get(day);
                                                    return (
                                                        <TableCell
                                                            key={day}
                                                            className={`border text-center p-0 h-8 transition-colors ${(user?.role === 'foreman' || user?.role === 'manager')
                                                                ? "cursor-pointer hover:bg-muted/30"
                                                                : ""
                                                                }`}
                                                            onClick={() => handleCellClick(row._id, day)}
                                                        >
                                                            {typeof hk === "number" ? (
                                                                <div className="flex items-center justify-center w-full h-full text-green-600 font-bold bg-green-50">{formatHK(hk)}</div>
                                                            ) : null}
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell className="border text-center font-bold sticky right-0 bg-background z-20">{formatHK(row.totalHK)}</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    if (item.kind === "mandorTotal") {
                                        return (
                                            <TableRow key={`mandor-total-${idx}`} className="bg-muted/40">
                                                {/* PT & DIVISI cells are covered by rowSpan from employee rows above */}
                                                <TableCell
                                                    colSpan={2}
                                                    className="border font-bold sticky left-[140px] bg-background z-20 whitespace-nowrap shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                                >
                                                    {item.label}
                                                </TableCell>
                                                {daysArray.map((day) => (
                                                    <TableCell key={day} className="border text-center font-bold p-0 h-8">
                                                        {item.totalsByDay.get(day) ? formatHK(item.totalsByDay.get(day) || 0) : ""}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="border text-center font-bold sticky right-0 bg-background z-20">{formatHK(item.totalHK)}</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    if (item.kind === "divisionTotal") {
                                        return (
                                            <TableRow key={`division-total-${idx}`} className="bg-muted/40">
                                                {/* PT cell is covered by rowSpan from employee rows above */}
                                                <TableCell
                                                    colSpan={3}
                                                    className="border font-bold sticky left-[60px] bg-background z-20 whitespace-nowrap shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                                >
                                                    {item.label}
                                                </TableCell>
                                                {daysArray.map((day) => (
                                                    <TableCell key={day} className="border text-center font-bold p-0 h-8">
                                                        {item.totalsByDay.get(day) ? formatHK(item.totalsByDay.get(day) || 0) : ""}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="border text-center font-bold sticky right-0 bg-background z-20">{formatHK(item.totalHK)}</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    if (item.kind === "ptTotal") {
                                        return (
                                            <TableRow key={`pt-total-${idx}`} className="bg-muted/40">
                                                <TableCell
                                                    colSpan={4}
                                                    className="border font-bold sticky left-0 bg-background z-20 whitespace-nowrap shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                                >
                                                    {item.label}
                                                </TableCell>
                                                {daysArray.map((day) => (
                                                    <TableCell key={day} className="border text-center font-bold p-0 h-8">
                                                        {item.totalsByDay.get(day) ? formatHK(item.totalsByDay.get(day) || 0) : ""}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="border text-center font-bold sticky right-0 bg-background z-20">{formatHK(item.totalHK)}</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    // grandTotal
                                    return (
                                        <TableRow key={`grand-total-${idx}`} className="bg-muted/40">
                                            <TableCell
                                                colSpan={4}
                                                className="border font-bold sticky left-0 bg-background z-20 whitespace-nowrap shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                            >
                                                {item.label}
                                            </TableCell>
                                            {daysArray.map((day) => (
                                                <TableCell key={day} className="border text-center font-bold p-0 h-8">
                                                    {item.totalsByDay.get(day) ? formatHK(item.totalsByDay.get(day) || 0) : ""}
                                                </TableCell>
                                            ))}
                                            <TableCell className="border text-center font-bold sticky right-0 bg-background z-20">{formatHK(item.totalHK)}</TableCell>
                                        </TableRow>
                                    );
                                })}

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
