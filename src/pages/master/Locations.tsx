import { useState } from 'react';
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

interface Location {
  id: string;
  code: string;
  name: string;
  description: string;
}

const Locations = () => {
  const [search, setSearch] = useState('');
  const [locations] = useState<Location[]>([
    { id: '1', code: 'APK-01', name: 'Afdeling APK 1', description: 'Area penanaman kelapa sawit bagian utara' },
    { id: '2', code: 'TPN-01', name: 'Afdeling TPN 1', description: 'Area tanaman produktif bagian timur' },
    { id: '3', code: 'DIV-01', name: 'Divisi 1', description: 'Divisi pemanenan utama' },
  ]);

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(search.toLowerCase()) ||
    loc.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lokasi</h1>
          <p className="text-muted-foreground">Kelola data lokasi/afdeling</p>
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
                <Input id="name" placeholder="Afdeling APK 1" />
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