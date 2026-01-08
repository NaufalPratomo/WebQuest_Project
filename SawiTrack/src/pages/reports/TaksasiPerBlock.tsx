import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TaksasiRow = {
  timestamp: string;
  date: string;
  estateId: string;
  estateName: string;
  divisionId: string;
  blockLabel: string;
  totalPokok: number;
  samplePokok: number;
  bm: number;
  ptb: number;
  bmbb: number;
  bmm: number;
  avgWeightKg: number;
  basisJanjangPerPemanen: number;
  akpPercent: number;
  taksasiJanjang: number;
  taksasiTon: number;
  kebutuhanPemanen: number;
};

export default function TaksasiPerBlock() {
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [rows, setRows] = useState<TaksasiRow[]>([]);
  const [estates, setEstates] = useState<
    Array<{ _id: string; estate_name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    api
      .estates()
      .then(setEstates)
      .catch(() => setEstates([]));
  }, []);

  const exportCsv = () => {
    const header = [
      "Estate",
      "Divisi",
      "Blok",
      "Pokok",
      "Sample",
      "BH",
      "PTB",
      "BMBB",
      "BMM",
      "AKP %",
      "Ton",
      "Perkiraan Kg",
      "Pemanen",
    ];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? "" : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [
          r.estateName || r.estateId,
          r.divisionId,
          r.blockLabel,
          r.totalPokok,
          r.samplePokok,
          r.bm,
          r.ptb,
          r.bmbb,
          r.bmm,
          r.akpPercent,
          r.taksasiTon,
          Math.round(r.taksasiTon * 1000),
          r.kebutuhanPemanen,
        ]
          .map(escape)
          .join(",")
      )
    );
    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taksasi_per_blok_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await api.taksasiList({ date });
      const mapped: TaksasiRow[] = (list || []).map((doc) => ({
        timestamp: doc._id || "",
        date: (doc.date || "").split("T")[0] || date,
        estateId: doc.estateId,
        estateName:
          estates.find((e) => e._id === doc.estateId)?.estate_name ||
          doc.estateId,
        divisionId: String(doc.division_id),
        blockLabel: doc.block_no,
        totalPokok: doc.totalPokok ?? 0,
        samplePokok: doc.samplePokok ?? 0,
        bm: doc.bm ?? 0,
        ptb: doc.ptb ?? 0,
        bmbb: doc.bmbb ?? 0,
        bmm: doc.bmm ?? 0,
        avgWeightKg: doc.avgWeightKg ?? 15,
        basisJanjangPerPemanen: doc.basisJanjangPerPemanen ?? 120,
        akpPercent: doc.akpPercent ?? 0,
        taksasiJanjang:
          doc.taksasiJanjang ??
          Math.round((doc.weightKg || 0) / (doc.avgWeightKg || 15)),
        taksasiTon: doc.taksasiTon ?? (doc.weightKg || 0) / 1000,
        kebutuhanPemanen: doc.kebutuhanPemanen ?? 0,
      }));
      setRows(mapped);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal memuat data taksasi";
      setError(msg);
      setRows([]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      blok: r.blockLabel,
      ton: parseFloat(r.taksasiTon.toFixed(2)),
    }));
  }, [rows]);

  const summary = useMemo(() => {
    const totalTon = rows.reduce((sum, r) => sum + r.taksasiTon, 0);
    const totalPemanen = rows.reduce((sum, r) => sum + r.kebutuhanPemanen, 0);
    const totalBlok = rows.length;
    return { totalTon, totalPemanen, totalBlok };
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Report Taksasi per Blok</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={exportCsv}
                disabled={rows.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Tanggal</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chart Visualization */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">
              Visualisasi Tonase per Blok
            </h3>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="blok" />
                  <YAxis />
                  <ChartTooltip />
                  <Legend />
                  <Bar dataKey="ton" fill="#f97316" name="Taksasi (Ton)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Data Taksasi per Blok</h3>
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="p-1 hover:bg-gray-100 rounded transition"
              title="Lihat keterangan"
            >
              <HelpCircle className="h-5 w-5 text-gray-600 hover:text-orange-500" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {showLegend && (
            <Card className="mb-4 bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <h4 className="font-semibold text-sm">Keterangan Kolom</h4>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <strong>BH</strong> = Buah Hitam
                </div>
                <div>
                  <strong>PTB</strong> = Pokok Tidak Berbuah
                </div>
                <div>
                  <strong>BMBB</strong> = Buah Merah Belum Brondol
                </div>
                <div>
                  <strong>BMM</strong> = Buah Merah Membrodol
                </div>
                <div>
                  <strong>AKP %</strong> = Angka Kepala Pokok (% buah matang)
                </div>
              </CardContent>
            </Card>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Estate</TableHead>
                  <TableHead className="text-center">Divisi</TableHead>
                  <TableHead className="text-center">Blok</TableHead>
                  <TableHead className="text-center">Pokok</TableHead>
                  <TableHead className="text-center">Sample</TableHead>
                  <TableHead className="text-center">BH</TableHead>
                  <TableHead className="text-center">PTB</TableHead>
                  <TableHead className="text-center">BMBB</TableHead>
                  <TableHead className="text-center">BMM</TableHead>
                  <TableHead className="text-center">AKP %</TableHead>
                  <TableHead className="text-center">Ton</TableHead>
                  <TableHead className="text-center">Perkiraan Kg</TableHead>
                  <TableHead className="text-center">Pemanen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-sm">
                      Memuat…
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center">
                        {r.estateName || r.estateId}
                      </TableCell>
                      <TableCell className="text-center">
                        {/^\d+$/.test(r.divisionId)
                          ? `Divisi ${r.divisionId}`
                          : r.divisionId}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.blockLabel}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.totalPokok}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.samplePokok}
                      </TableCell>
                      <TableCell className="text-center">{r.bm}</TableCell>
                      <TableCell className="text-center">{r.ptb}</TableCell>
                      <TableCell className="text-center">{r.bmbb}</TableCell>
                      <TableCell className="text-center">{r.bmm}</TableCell>
                      <TableCell className="text-center">
                        {r.akpPercent.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.taksasiTon.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {Math.round(r.taksasiTon * 1000)}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.kebutuhanPemanen}
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && rows.length === 0 && !error && (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                )}
                {!loading && error && (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="text-center text-sm text-destructive"
                    >
                      {error}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
