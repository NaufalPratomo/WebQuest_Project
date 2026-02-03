import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { API_BASE } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ActivityLog {
  _id: string;
  user_name: string;
  role: string;
  action: string;
  details: Record<string, unknown>;
  ip_address: string;
  timestamp: string;
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/activity-logs?page=${page}&limit=${limit}`, {
          cache: 'no-cache',
        });
        if (!res.ok) throw new Error('Failed to fetch');

        const json = await res.json();
        setLogs(json.data || []);
        setTotal(json.pagination?.pages || 1);
      } catch (err) {
        toast.error('Gagal memuat log aktivitas');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page]);

  const formatDetails = (details: unknown): string => {
    if (!details || typeof details !== 'object') return '';
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Log Aktivitas</h1>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Sistem</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Aksi</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Tidak ada log
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map(log => (
                      <TableRow key={log._id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell>{log.user_name}</TableCell>
                        <TableCell className="capitalize">{log.role}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-secondary px-2 py-1 rounded">
                            {log.action}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate text-xs" title={formatDetails(log.details)}>
                            {formatDetails(log.details)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.ip_address}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-muted-foreground">
                  Halaman {page} dari {total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= total}
                  onClick={() => setPage(p => p + 1)}
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