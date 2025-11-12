import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Division = { division_id: number };
type Block = {
  id_blok?: string;
  no_blok?: string;
  luas_blok?: number;
  jumlak_pokok?: number;
  jumlah_pokok?: number;
  SPH?: number;
  jenis_tanah?: string;
  topografi?: string;
  tahun_?: number;
  luas_tanaman_?: number;
  jenis_bibit?: string;
  luas_nursery?: number;
  luas_lain___lain?: number;
  luas_lain__lain?: number;
  luas_garapan?: number;
  luas_rawa?: number;
  luas_area_non_efektif?: number;
  luas_konservasi?: number;
  location?: { type?: string; coordinates?: unknown };
  [key: string]: unknown;
};
type EstateLite = { _id: string; estate_name: string };

const Locations = () => {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estates, setEstates] = useState<EstateLite[]>([]);
  const [meta, setMeta] = useState<
    Record<
      string,
      { divisions: Division[]; blocksByDivision: Record<number, Block[]> }
    >
  >({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .estates()
      .then((data) => {
        if (!mounted) return;
        setEstates(data || []);
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      const next: Record<
        string,
        { divisions: Division[]; blocksByDivision: Record<number, Block[]> }
      > = {};
      for (const es of estates) {
        try {
          const divs: Division[] = await api.divisions(es._id);
          const blocksByDivision: Record<number, Block[]> = {};
          for (const d of divs || []) {
            try {
              const blocks = await api.blocks(es._id, d.division_id);
              blocksByDivision[d.division_id] = Array.isArray(blocks)
                ? (blocks as Block[])
                : [];
            } catch {
              blocksByDivision[d.division_id] = [];
            }
          }
          next[es._id] = { divisions: divs || [], blocksByDivision };
        } catch {
          next[es._id] = { divisions: [], blocksByDivision: {} };
        }
      }
      if (!cancelled) setMeta(next);
    }
    if (estates.length > 0) loadMeta();
    return () => {
      cancelled = true;
    };
  }, [estates]);

  const filteredEstates = useMemo(
    () =>
      estates.filter((es) =>
        es.estate_name.toLowerCase().includes(search.toLowerCase())
      ),
    [estates, search]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Aresta</h1>
          <p className="text-muted-foreground">Kelola data Aresta</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && (
            <p className="text-sm text-muted-foreground">Memuat data...</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-2">
            <Label htmlFor="search-estate">Cari Estate</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-estate"
                placeholder="Ketik nama estate..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {filteredEstates.map((es) => {
              const metaEs = meta[es._id];
              const blocksFlat: Array<{ division_id: number; block: Block }> =
                metaEs
                  ? Object.entries(metaEs.blocksByDivision).flatMap(
                      ([divId, blks]) =>
                        (blks || []).map((b) => ({
                          division_id: Number(divId),
                          block: b,
                        }))
                    )
                  : [];
              return (
                <AccordionItem key={es._id} value={es._id}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{es.estate_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {metaEs?.divisions?.length ?? 0} divisi —{" "}
                        {blocksFlat.length} blok
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <Table className="min-w-max">
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Divisi</TableHead>
                            <TableHead>No Blok</TableHead>
                            <TableHead>ID Blok</TableHead>
                            <TableHead className="text-right">
                              Luas Blok
                            </TableHead>
                            <TableHead className="text-right">
                              Jumlah Pokok
                            </TableHead>
                            <TableHead className="text-right">SPH</TableHead>
                            <TableHead>Jenis Tanah</TableHead>
                            <TableHead>Topografi</TableHead>
                            <TableHead>Tahun</TableHead>
                            <TableHead>Jenis Bibit</TableHead>
                            <TableHead className="text-right">
                              Luas Nursery
                            </TableHead>
                            <TableHead className="text-right">
                              Luas Lain-Lain
                            </TableHead>
                            <TableHead className="text-right">
                              Luas Garapan
                            </TableHead>
                            <TableHead className="text-right">
                              Luas Rawa
                            </TableHead>
                            <TableHead className="text-right">
                              Non Efektif
                            </TableHead>
                            <TableHead className="text-right">
                              Konservasi
                            </TableHead>
                            <TableHead >Location Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {blocksFlat.map(({ division_id, block }, idx) => (
                            <TableRow
                              key={`${division_id}-${
                                block.no_blok ?? block.id_blok ?? idx
                              }`}
                            >
                              <TableCell>Divisi {division_id}</TableCell>
                              <TableCell>
                                {String(block.no_blok ?? "")}
                              </TableCell>
                              <TableCell>
                                {String(block.id_blok ?? "")}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {block.luas_blok ?? "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {block.jumlah_pokok ??
                                  block.jumlak_pokok ??
                                  "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {block.SPH ?? "-"}
                              </TableCell>
                              <TableCell>
                                {String(block.jenis_tanah ?? "")}
                              </TableCell>
                              <TableCell>
                                {String(block.topografi ?? "")}
                              </TableCell>
                              <TableCell>
                                {String(block.tahun_ ?? block.tahun ?? "-")}
                              </TableCell>
                              <TableCell>
                                {String(block.jenis_bibit ?? "-")}
                              </TableCell>
                              <TableCell className="text-right">
                                {block.luas_nursery ?? "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {block.luas_lain___lain ??
                                  block.luas_lain__lain ??
                                  "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {block.luas_garapan ?? "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {block.luas_rawa ?? "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {block.luas_area_non_efektif ?? "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {block.luas_konservasi ?? "-"}
                              </TableCell>
                              <TableCell>
                                {block.location?.type ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                          {blocksFlat.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={18}
                                className="text-center text-sm text-muted-foreground"
                              >
                                Tidak ada data blok
                              </TableCell>
                            </TableRow>
                          )}
                          {blocksFlat.length > 0 && (
                            <TableRow className="bg-muted/50 font-bold">
                              <TableCell colSpan={1}>TOTAL:</TableCell>
                              <TableCell className="text-right">
                                {new Set(blocksFlat.map(({ division_id }) => division_id)).size} Divisi, {new Set(blocksFlat.map(({ block }) => block.id_blok)).size} Blok
                              </TableCell>
                              <TableCell colSpan={14}></TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default Locations;
