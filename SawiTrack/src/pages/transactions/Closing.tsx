import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ClosedMonth {
  year: number;
  month: number;
}

const Closing = () => {
  const [closedMonths, setClosedMonths] = useState<ClosedMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    fetchClosedMonths();
  }, []);

  const fetchClosedMonths = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call to get closed months
      const months = await api.closedMonths();
      setClosedMonths(months);
    } catch (error) {
      toast.error('Gagal memuat daftar bulan yang ditutup.');
      console.error('Error fetching closed months:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMonth = async () => {
    const yearNum = Number(selectedYear);
    const monthNum = Number(selectedMonth);
    const targetText = selectedYear && selectedMonth ? `${monthNum}/${yearNum}` : 'bulan ini';
    if (!confirm(`Apakah Anda yakin ingin menutup transaksi untuk ${targetText}? Data bulan sebelumnya tidak akan bisa diubah.`)) {
      return;
    }

    try {
      setClosing(true);
      const body = selectedYear && selectedMonth ? { year: yearNum, month: monthNum } : undefined;
      const res = await api.closeMonth(body);
      if (res.success) {
        toast.success('Bulan berhasil ditutup!');
        setSelectedYear('');
        setSelectedMonth('');
        fetchClosedMonths();
      } else {
        toast.error(res.message || 'Gagal menutup bulan.');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat menutup bulan.');
      console.error('Error closing month:', error);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Data Closing Transaksi</h1>
      <p className="text-muted-foreground">Kelola penutupan transaksi bulanan. Data pada bulan yang sudah ditutup tidak dapat diubah.</p>

      <Card>
        <CardHeader>
          <CardTitle>Tutup Bulan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Tahun</Label>
              <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tahun (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const year = new Date().getFullYear() - 2 + i; // range: currentYear-2 .. currentYear+3
                    return (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bulan</Label>
              <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih bulan (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = i + 1;
                    const y = Number(selectedYear);
                    const isClosed = selectedYear ? closedMonths.some(cm => cm.year === y && cm.month === m) : false;
                    return (
                      <SelectItem key={m} value={String(m)} disabled={isClosed}>
                        {m} {isClosed ? '(Ditutup)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCloseMonth} disabled={closing || (selectedYear && selectedMonth && closedMonths.some(cm => cm.year === Number(selectedYear) && cm.month === Number(selectedMonth)))} className="w-full">
                {closing ? 'Menutup...' : (selectedYear && selectedMonth ? (closedMonths.some(cm => cm.year === Number(selectedYear) && cm.month === Number(selectedMonth)) ? 'Sudah Ditutup' : `Tutup ${selectedMonth}/${selectedYear}`) : 'Tutup Bulan Ini')}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Jika Anda tidak memilih tahun/bulan, sistem akan menutup bulan berjalan.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulan yang Sudah Ditutup</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Memuat daftar bulan...</p>
          ) : closedMonths.length === 0 ? (
            <p>Belum ada bulan yang ditutup.</p>
          ) : (
            <ul className="list-disc pl-5">
              {closedMonths.map((month, index) => (
                <li key={index}>{`${month.month}/${month.year}`}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Closing;