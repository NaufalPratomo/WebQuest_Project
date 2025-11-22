import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface Log {
    _id: string;
    user_name: string;
    role: string;
    action: string;
    details: any;
    ip_address: string;
    timestamp: string;
}

export default function ActivityLog() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = async (pageNum: number) => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/activity-logs?page=${pageNum}&limit=20`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.data) {
                setLogs(data.data);
                setTotalPages(data.pagination.pages);
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Log Aktivitas</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Aktivitas Sistem</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Waktu</TableHead>
                                        <TableHead>Pengguna</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Aksi</TableHead>
                                        <TableHead>Detail</TableHead>
                                        <TableHead>IP</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center">
                                                Tidak ada log aktivitas ditemukan.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logs.map((log) => (
                                            <TableRow key={log._id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(log.timestamp), "dd MMM yyyy HH:mm:ss")}
                                                </TableCell>
                                                <TableCell className="font-medium">{log.user_name}</TableCell>
                                                <TableCell className="capitalize">{log.role}</TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                        {log.action}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="max-w-xs truncate" title={JSON.stringify(log.details)}>
                                                    {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                                                </TableCell>
                                                <TableCell>{log.ip_address}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            <div className="flex items-center justify-end space-x-2 py-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <div className="text-sm text-muted-foreground">
                                    Halaman {page} dari {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Selanjutnya
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
