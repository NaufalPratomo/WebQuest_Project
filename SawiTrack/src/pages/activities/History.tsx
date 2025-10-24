import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Eye } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { api, ReportDoc } from '@/lib/api';

interface ReportRow {
  id: string;
  date: string;
  division: string;
  jobType: string;
  hk: number;
  status: 'pending' | 'approved' | 'rejected';
}

const History = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    if (!user?.name) return;
    setLoading(true);
    api.reports({ employeeName: user.name })
      .then((list: ReportDoc[]) => {
        if (!mounted) return;
        const mapped: ReportRow[] = list.map(r => ({
          id: r._id,
          date: r.date,
          division: r.division,
          jobType: r.jobType,
          hk: r.hk,
          status: r.status,
        }));
        setRows(mapped);
      })
      .catch(e => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [user?.name]);

  const filteredReports = useMemo(() => rows.filter(report => {
    const matchesSearch = report.division.toLowerCase().includes(search.toLowerCase()) ||
      report.jobType.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [rows, search, statusFilter]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      approved: 'default',
      pending: 'secondary',
      rejected: 'destructive',
    };
    const labels: Record<string, string> = {
      approved: 'Disetujui',
      pending: 'Menunggu',
      rejected: 'Ditolak',
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Riwayat Laporan</h1>
        <p className="text-muted-foreground">Lihat semua laporan yang telah disubmit</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground">Memuat data...</p>}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari laporan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="approved">Disetujui</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Jenis Pekerjaan</TableHead>
                <TableHead>HK</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{new Date(report.date).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell className="font-medium">{report.division}</TableCell>
                  <TableCell>{report.jobType}</TableCell>
                  <TableCell>{report.hk}</TableCell>
                  <TableCell>{getStatusBadge(report.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default History;