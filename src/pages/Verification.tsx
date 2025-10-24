import { useState } from 'react';
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
  const [reports] = useState<Report[]>([
    {
      id: '1',
      employeeName: 'Ahmad Yani',
      date: '2025-10-17',
      division: 'APK',
      jobType: 'Panen',
      hk: 1.0,
      notes: 'Panen area blok A',
      status: 'pending',
    },
    {
      id: '2',
      employeeName: 'Siti Nurhaliza',
      date: '2025-10-17',
      division: 'TPN',
      jobType: 'Perawatan',
      hk: 0.5,
      notes: 'Pemupukan area blok B',
      status: 'pending',
    },
    {
      id: '3',
      employeeName: 'Budi Santoso',
      date: '2025-10-16',
      division: 'APK',
      jobType: 'Penanaman',
      hk: 1.0,
      notes: 'Penanaman bibit baru',
      status: 'approved',
    },
  ]);

  const pendingReports = reports.filter(r => r.status === 'pending');
  const verifiedReports = reports.filter(r => r.status !== 'pending');

  const handleApprove = (id: string) => {
    toast.success('Laporan berhasil disetujui');
  };

  const handleReject = (id: string) => {
    toast.success('Laporan berhasil ditolak');
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
        <p className="text-muted-foreground">
          Verifikasi laporan harian dari karyawan
        </p>
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