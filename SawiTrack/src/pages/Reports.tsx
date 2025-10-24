import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Reports = () => {
  const [startDate, setStartDate] = useState('2025-10-01');
  const [endDate, setEndDate] = useState('2025-10-31');

  const handleExport = (type: string, format: string) => {
    toast.success(`Export ${type} dalam format ${format.toUpperCase()} berhasil`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Laporan & Export</h1>
        <p className="text-muted-foreground">Generate dan export berbagai laporan</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reportStartDate">Tanggal Mulai</Label>
              <Input
                id="reportStartDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportEndDate">Tanggal Akhir</Label>
              <Input
                id="reportEndDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="employee" className="w-full">
        <TabsList>
          <TabsTrigger value="employee">Per Karyawan</TabsTrigger>
          <TabsTrigger value="division">Per Divisi</TabsTrigger>
          <TabsTrigger value="bkm">BKM</TabsTrigger>
        </TabsList>

        <TabsContent value="employee" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Per Karyawan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Pilih Karyawan</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua karyawan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Karyawan</SelectItem>
                      <SelectItem value="1">Ahmad Yani</SelectItem>
                      <SelectItem value="2">Siti Nurhaliza</SelectItem>
                      <SelectItem value="3">Budi Santoso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employeeDivision">Filter Divisi</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua divisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Divisi</SelectItem>
                      <SelectItem value="apk">APK</SelectItem>
                      <SelectItem value="tpn">TPN</SelectItem>
                      <SelectItem value="divisi">Divisi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport('Laporan Karyawan', 'excel')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport('Laporan Karyawan', 'pdf')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Konten Laporan:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Data pribadi karyawan</li>
                  <li>Total HK per periode</li>
                  <li>Detail aktivitas harian</li>
                  <li>Status verifikasi</li>
                  <li>Total gaji dan premi</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="division" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Per Divisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="divisionSelect">Pilih Divisi</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua divisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Divisi</SelectItem>
                      <SelectItem value="apk">APK</SelectItem>
                      <SelectItem value="tpn">TPN</SelectItem>
                      <SelectItem value="divisi">Divisi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportType">Jenis Laporan</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Ringkasan</SelectItem>
                      <SelectItem value="detailed">Detail</SelectItem>
                      <SelectItem value="financial">Keuangan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport('Laporan Divisi', 'excel')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport('Laporan Divisi', 'pdf')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Konten Laporan:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Jumlah karyawan per divisi</li>
                  <li>Total HK dan produktivitas</li>
                  <li>Target vs realisasi</li>
                  <li>Breakdown biaya operasional</li>
                  <li>Analisis performa</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bkm" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Laporan BKM (Bukti Kas Masuk)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bkmDivision">Filter Divisi</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua divisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Divisi</SelectItem>
                      <SelectItem value="apk">APK</SelectItem>
                      <SelectItem value="tpn">TPN</SelectItem>
                      <SelectItem value="divisi">Divisi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bkmType">Tipe Transaksi</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Tipe</SelectItem>
                      <SelectItem value="income">Pemasukan</SelectItem>
                      <SelectItem value="expense">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport('Laporan BKM', 'excel')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport('Laporan BKM', 'pdf')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Konten Laporan:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Daftar transaksi kas</li>
                  <li>Total pemasukan dan pengeluaran</li>
                  <li>Saldo per periode</li>
                  <li>Kategori transaksi</li>
                  <li>Referensi dokumen</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;