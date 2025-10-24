import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const Recap = () => {
  const [startDate, setStartDate] = useState('2025-10-01');
  const [endDate, setEndDate] = useState('2025-10-31');

  const hkData = [
    { employee: 'Ahmad Yani', division: 'APK', totalHK: 22.0, approved: 22.0, pending: 0, rejected: 0 },
    { employee: 'Siti Nurhaliza', division: 'TPN', totalHK: 20.5, approved: 18.5, pending: 2.0, rejected: 0 },
    { employee: 'Budi Santoso', division: 'APK', totalHK: 21.0, approved: 21.0, pending: 0, rejected: 0 },
  ];

  const costData = [
    {
      division: 'APK',
      biayaPanen: 15000000,
      biayaPerawatan: 8000000,
      biayaTransport: 3000000,
      premi: 2000000,
      payroll: 50000000,
      bpjs: 5000000,
    },
    {
      division: 'TPN',
      biayaPanen: 12000000,
      biayaPerawatan: 7000000,
      biayaTransport: 2500000,
      premi: 1800000,
      payroll: 45000000,
      bpjs: 4500000,
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rekapitulasi</h1>
        <p className="text-muted-foreground">Rekap HK dan biaya per divisi</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Periode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Tanggal Akhir</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => toast.success('Data berhasil difilter')}>
                Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="hk" className="w-full">
        <TabsList>
          <TabsTrigger value="hk">Rekap HK</TabsTrigger>
          <TabsTrigger value="costs">Rekap Biaya & Premi</TabsTrigger>
        </TabsList>

        <TabsContent value="hk" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Rekapitulasi Hari Kerja (HK)</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Divisi</TableHead>
                    <TableHead className="text-right">Total HK</TableHead>
                    <TableHead className="text-right">Disetujui</TableHead>
                    <TableHead className="text-right">Menunggu</TableHead>
                    <TableHead className="text-right">Ditolak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hkData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.employee}</TableCell>
                      <TableCell>{row.division}</TableCell>
                      <TableCell className="text-right font-semibold">{row.totalHK}</TableCell>
                      <TableCell className="text-right text-success">{row.approved}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.pending}</TableCell>
                      <TableCell className="text-right text-destructive">{row.rejected}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">
                      {hkData.reduce((sum, row) => sum + row.totalHK, 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {hkData.reduce((sum, row) => sum + row.approved, 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {hkData.reduce((sum, row) => sum + row.pending, 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {hkData.reduce((sum, row) => sum + row.rejected, 0).toFixed(1)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Rekapitulasi Biaya & Premi</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Divisi</TableHead>
                      <TableHead className="text-right">Biaya Panen</TableHead>
                      <TableHead className="text-right">Biaya Perawatan</TableHead>
                      <TableHead className="text-right">Biaya Transport</TableHead>
                      <TableHead className="text-right">Premi</TableHead>
                      <TableHead className="text-right">Payroll</TableHead>
                      <TableHead className="text-right">BPJS</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costData.map((row, idx) => {
                      const total =
                        row.biayaPanen +
                        row.biayaPerawatan +
                        row.biayaTransport +
                        row.premi +
                        row.payroll -
                        row.bpjs;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.division}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.biayaPanen)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.biayaPerawatan)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.biayaTransport)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.premi)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.payroll)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            -{formatCurrency(row.bpjs)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(costData.reduce((sum, row) => sum + row.biayaPanen, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(costData.reduce((sum, row) => sum + row.biayaPerawatan, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(costData.reduce((sum, row) => sum + row.biayaTransport, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(costData.reduce((sum, row) => sum + row.premi, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(costData.reduce((sum, row) => sum + row.payroll, 0))}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatCurrency(costData.reduce((sum, row) => sum + row.bpjs, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          costData.reduce(
                            (sum, row) =>
                              sum +
                              row.biayaPanen +
                              row.biayaPerawatan +
                              row.biayaTransport +
                              row.premi +
                              row.payroll -
                              row.bpjs,
                            0
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Recap;