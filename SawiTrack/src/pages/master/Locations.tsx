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
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
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
import { api } from '@/lib/api';

type Division = { division_id: number };
type EstateLite = { _id: string; estate_name: string };

const Locations = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estates, setEstates] = useState<EstateLite[]>([]);
  const [selectedEstate, setSelectedEstate] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.estates()
      .then((data) => {
        if (!mounted) return;
        setEstates(data);
        if (data.length > 0) setSelectedEstate(data[0]._id);
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedEstate) return;
    let mounted = true;
    setLoading(true);
    api.divisions(selectedEstate)
      .then((data) => { if (mounted) setDivisions(data); })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [selectedEstate]);

  const locations = useMemo(() => {
    // Map divisions to a simple location view
    return divisions.map((d) => ({
      id: `${selectedEstate}-${d.division_id}`,
      code: `DIV-${d.division_id.toString().padStart(2, '0')}`,
      name: `Divisi ${d.division_id}`,
      description: estates.find(e => e._id === selectedEstate)?.estate_name || 'Divisi estate',
    }));
  }, [divisions, selectedEstate, estates]);

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(search.toLowerCase()) ||
    loc.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lokasi</h1>
          <p className="text-muted-foreground">Kelola data lokasi/Divisi</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground">Memuat data...</p>}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Lokasi
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Lokasi Baru</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode</Label>
                <Input id="code" placeholder="APK-01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lokasi</Label>
                <Input id="name" placeholder="Divisi APK 1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea id="description" placeholder="Deskripsi lokasi..." />
              </div>
              <Button type="button" className="w-full" onClick={() => toast.success('Lokasi berhasil ditambahkan')}>
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
              placeholder="Cari lokasi..."
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
                <TableHead>Kode</TableHead>
                <TableHead>Nama Lokasi</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.code}</TableCell>
                  <TableCell>{location.name}</TableCell>
                  <TableCell className="text-muted-foreground">{location.description}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

export default Locations;