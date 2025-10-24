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
import { Plus, Search, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api, Target as TargetDoc } from '@/lib/api';

interface TargetRow {
  id: string;
  division: string;
  period: string;
  target: number;
  achieved: number;
  status: string;
}

const Targets = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TargetRow[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.targets()
      .then((list: TargetDoc[]) => {
        if (!mounted) return;
        const mapped: TargetRow[] = list.map(t => ({
          id: t._id,
          division: t.division,
          period: t.period,
          target: t.target,
          achieved: t.achieved,
          status: t.status,
        }));
        setRows(mapped);
      })
      .catch(e => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  const filteredTargets = useMemo(() => rows.filter(t =>
    t.division.toLowerCase().includes(search.toLowerCase()) ||
    t.period.includes(search)
  ), [rows, search]);

  const getPercentage = (achieved: number, target: number) => {
    return ((achieved / target) * 100).toFixed(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Target Penanaman</h1>
          <p className="text-muted-foreground">Kelola target penanaman per divisi</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground">Memuat data...</p>}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Target
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Target Baru</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="division">Divisi</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apk">APK</SelectItem>
                    <SelectItem value="tpn">TPN</SelectItem>
                    <SelectItem value="divisi">Divisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Periode</Label>
                <Input id="period" type="month" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">Jumlah Target</Label>
                <Input id="target" type="number" placeholder="1000" />
              </div>
              <Button type="button" className="w-full" onClick={() => toast.success('Target berhasil ditambahkan')}>
                Simpan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Divisi</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Tercapai</TableHead>
                <TableHead>Persentase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTargets.map((target) => {
                const percentage = parseInt(getPercentage(target.achieved, target.target));
                return (
                  <TableRow key={target.id}>
                    <TableCell className="font-medium">{target.division}</TableCell>
                    <TableCell>{target.period}</TableCell>
                    <TableCell>{target.target}</TableCell>
                    <TableCell>{target.achieved}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              percentage >= 80 ? 'bg-success' : percentage >= 50 ? 'bg-primary' : 'bg-accent'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm">{percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={target.status === 'active' ? 'default' : 'secondary'}>
                        {target.status === 'active' ? 'Aktif' : 'Selesai'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Targets;