import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api, ReportDoc } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Report {
  id: string;
  employeeName: string;
  date: string;
  division: string;
  jobType: string;
  hk: number;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
}

const Verification = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.reports()
      .then((list: ReportDoc[]) => {
        if (!mounted) return;
        const mapped: Report[] = list.map(r => ({
          id: r._id,
          employeeName: r.employeeName,
          date: r.date,
          division: r.division,
          jobType: r.jobType,
          hk: r.hk,
          notes: r.notes || '',
          status: r.status,
        }));
        setReports(mapped);
      })
      .catch(e => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  const pendingReports = useMemo(() => reports.filter(r => r.status === 'pending'), [reports]);
  const verifiedReports = useMemo(() => reports.filter(r => r.status !== 'pending'), [reports]);

  const handleApprove = async (id: string) => {
    try {
      await api.approveReport(id);
      setReports(prev => prev.map(r => (r.id === id ? { ...r, status: 'approved' } : r)));
      toast.success('Laporan berhasil disetujui');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyetujui laporan';
      toast.error(msg);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectReport(id);
      setReports(prev => prev.map(r => (r.id === id ? { ...r, status: 'rejected' } : r)));
      toast.success('Laporan berhasil ditolak');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menolak laporan';
      toast.error(msg);
    }
  };

  const ReportTable = ({ data }: { data: Report[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Karyawan</TableHead>
          <TableHead>Tanggal</TableHead>
          <TableHead>Divisi</TableHead>
          <TableHead>Jenis Pekerjaan</TableHead>
          <TableHead>HK</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((report) => (
          <TableRow key={report.id}>
            <TableCell className="font-medium">{report.employeeName}</TableCell>
            <TableCell>{new Date(report.date).toLocaleDateString('id-ID')}</TableCell>
            <TableCell>{report.division}</TableCell>
            <TableCell>{report.jobType}</TableCell>
            <TableCell>{report.hk}</TableCell>
            <TableCell>
              <Badge
                variant={
                  report.status === 'approved'
                    ? 'default'
                    : report.status === 'rejected'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {report.status === 'approved'
                  ? 'Disetujui'
                  : report.status === 'rejected'
                  ? 'Ditolak'
                  : 'Menunggu'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Detail Laporan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Karyawan</Label>
                        <p className="text-sm mt-1">{report.employeeName}</p>
                      </div>
                      <div>
                        <Label>Tanggal</Label>
                        <p className="text-sm mt-1">
                          {new Date(report.date).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <div>
                        <Label>Divisi</Label>
                        <p className="text-sm mt-1">{report.division}</p>
                      </div>
                      <div>
                        <Label>Jenis Pekerjaan</Label>
                        <p className="text-sm mt-1">{report.jobType}</p>
                      </div>
                      <div>
                        <Label>HK</Label>
                        <p className="text-sm mt-1">{report.hk}</p>
                      </div>
                      <div>
                        <Label>Catatan</Label>
                        <p className="text-sm mt-1 text-muted-foreground">{report.notes}</p>
                      </div>
                      {report.status === 'pending' && (
                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={() => handleApprove(report.id)}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Setujui
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="destructive" className="flex-1">
                                <XCircle className="h-4 w-4 mr-2" />
                                Tolak
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Alasan Penolakan</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <Textarea
                                  placeholder="Masukkan alasan penolakan..."
                                  rows={4}
                                />
                                <Button
                                  onClick={() => handleReject(report.id)}
                                  variant="destructive"
                                  className="w-full"
                                >
                                  Tolak Laporan
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                {report.status === 'pending' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleApprove(report.id)}
                    >
                      <CheckCircle className="h-4 w-4 text-success" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReject(report.id)}
                    >
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Verifikasi Laporan</h1>
        <p className="text-muted-foreground">Verifikasi laporan harian dari karyawan</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground">Memuat data...</p>}
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Menunggu Persetujuan ({pendingReports.length})
          </TabsTrigger>
          <TabsTrigger value="verified">Sudah Diverifikasi</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Laporan Menunggu Persetujuan</h3>
                <Badge variant="secondary">{pendingReports.length} laporan</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ReportTable data={pendingReports} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verified" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Laporan yang Sudah Diverifikasi</h3>
                <Badge variant="secondary">{verifiedReports.length} laporan</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ReportTable data={verifiedReports} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Verification;