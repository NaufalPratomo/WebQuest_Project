import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import * as XLSX from 'xlsx';
import { Upload, Download, Activity, Target, Calculator } from 'lucide-react';

type EstateOption = { _id: string; estate_name: string };
type DivisionOption = { division_id: number | string };
type Block = {
  id_blok?: string;
  no_blok?: string;
  luas_blok?: number;
  jumlak_pokok?: number; 
  pokok_produktif?: number;
  pokok_belum_produktif?: number;
  pokok_mati?: number;
};

export default function TaksasiPanen() {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [estates, setEstates] = useState<EstateOption[]>([]);
  const [estateId, setEstateId] = useState<string>('');
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [divisionId, setDivisionId] = useState<string>('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockIndex, setBlockIndex] = useState<string>(''); // index of chosen block in blocks
  const [editingKey, setEditingKey] = useState<string | null>(null); // composite key for editing
  const [pendingEditBlockLabel, setPendingEditBlockLabel] = useState<string>('');

  type TaksasiRow = {
    timestamp: string; // ISO string when saved
    date: string; // YYYY-MM-DD
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
  const [rows, setRows] = useState<TaksasiRow[]>([]);

  // Import Preview State
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    newRows: TaksasiRow[];
    updatedRows: TaksasiRow[];
    duplicateRows: TaksasiRow[];
  } | null>(null);

  // Page 2 inputs
  const [bm, setBm] = useState<number>(0); // Buah Hitam (BH)
  const [ptb, setPtb] = useState<number>(0); // Pokok Tidak Berbuah
  const [bmbb, setBmbb] = useState<number>(0); // Buah Merah Belum Brondol
  const [bmm, setBmm] = useState<number>(0); // Buah Merah Membrodol
  const [avgWeightKg, setAvgWeightKg] = useState<number>(15);
  const [basisJanjangPerPemanen, setBasisJanjangPerPemanen] = useState<number>(120);

  // Employee selection for capacity
  type Emp = { _id: string; name: string; division?: string; role?: string };
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Custom ("Other") employees persisted in server collection
  const [customEmployees, setCustomEmployees] = useState<Emp[]>([]);
  const [otherName, setOtherName] = useState<string>('');
  const allEmployees = useMemo(() => [...employees, ...customEmployees], [employees, customEmployees]);

  // load estates once
  useEffect(() => {
    api.estates()
      .then(setEstates)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat estate'));
  }, []);

  // when estate changes, load divisions
  useEffect(() => {
    if (!estateId) { setDivisions([]); setDivisionId(''); setBlocks([]); setBlockIndex(''); return; }
    api.divisions(estateId)
      .then((rows) => setDivisions(rows || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat divisi'));
  }, [estateId]);

  // when division changes, load blocks
  useEffect(() => {
    if (!estateId || !divisionId) { setBlocks([]); setBlockIndex(''); return; }
    api.blocks(estateId, divisionId)
      .then((rows: Block[]) => setBlocks(rows || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat blok'));
  }, [estateId, divisionId]);

  // Load persisted taksasi rows from server when date changes
  useEffect(() => {
    if (!date) { setRows([]); return; }
    api.taksasiList({ date })
      .then((list) => {
        const mapped: TaksasiRow[] = (list || []).map((doc) => {
          const estateName = estates.find(e => e._id === doc.estateId)?.estate_name || '-';
          return {
            timestamp: doc._id || '',
            date: doc.date ? doc.date.split('T')[0] : date,
            estateId: doc.estateId,
            estateName,
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
            taksasiJanjang: doc.taksasiJanjang ?? Math.round((doc.weightKg || 0) / (doc.avgWeightKg || 15)),
            taksasiTon: doc.taksasiTon ?? (doc.weightKg || 0) / 1000,
            kebutuhanPemanen: doc.kebutuhanPemanen ?? 0,
          };
        });
        setRows(mapped);
      })
      .catch(() => setRows([]));
  }, [date, estates]);

  // load employees & custom workers (server persisted)
  useEffect(() => {
    api.employees()
      .then((list) => {
        const onlyKaryawan: Emp[] = (list || []).filter((e: unknown): e is Emp => {
          return typeof e === 'object' && e !== null && (e as { role?: string }).role === 'karyawan';
        });
        setEmployees(onlyKaryawan);
      })
      .catch(() => setEmployees([]));
    api.customWorkers()
      .then((list) => {
        const mapped: Emp[] = (list || []).map(w => ({ _id: String(w._id), name: w.name, role: 'karyawan' }));
        setCustomEmployees(mapped);
      })
      .catch(() => setCustomEmployees([]));
  }, []);

  // load selection for current context (date + estate + division + block)
  useEffect(() => {
    const blk = (() => { const i = Number(blockIndex); if (Number.isNaN(i) || i < 0 || i >= blocks.length) return undefined; return blocks[i]; })();
    if (!date || !estateId || !divisionId || !blk) { setSelectedIds([]); return; }
    const blockLabel = blk.no_blok || blk.id_blok || '-';
    api.taksasiSelections({ date, estateId, division_id: divisionId, block_no: blockLabel })
      .then((docs) => { if (docs && docs.length > 0) setSelectedIds(docs[0].employeeIds || []); else setSelectedIds([]); })
      .catch(() => setSelectedIds([]));
  }, [date, estateId, divisionId, blockIndex, blocks]);

  async function persistSelection(next: string[]) {
    if (!date || !estateId || !divisionId || !selectedBlock) return;
    const blockLabel = selectedBlock.no_blok || selectedBlock.id_blok || '-';
    try {
      await api.upsertTaksasiSelection({
        date,
        estateId,
        division_id: divisionId,
        block_no: blockLabel,
        employeeIds: next
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal simpan seleksi pemanen');
    }
  }

  const selectedBlock: Block | undefined = useMemo(() => {
    const i = Number(blockIndex);
    if (Number.isNaN(i) || i < 0 || i >= blocks.length) return undefined;
    return blocks[i];
  }, [blockIndex, blocks]);

  const totalPokok = selectedBlock?.jumlak_pokok ?? 0;
  const pProduktif = selectedBlock?.pokok_produktif ?? 0;
  const pBelumProduktif = selectedBlock?.pokok_belum_produktif ?? 0;
  const pMati = selectedBlock?.pokok_mati ?? 0;

  const samplePokok = useMemo(() => {
    // Priority: use produktif trees as base for census sample
    const base = pProduktif > 0 ? pProduktif : totalPokok;
    if (base <= 0) return 0;
    return Math.max(1, Math.ceil(base * 0.10));
  }, [totalPokok, pProduktif]);

  // Derived calculations for current editable context
  // RELEVANCE UPDATE: Since 2026 data separates PROD and MATI, 
  // we assume the census is done on the PROD population directly.
  const akpPercent = samplePokok > 0 ? (bmm / samplePokok) * 100 : 0;
  
  // Janjang calculation: AKP * Produktif Trees
  const calculationBase = pProduktif > 0 ? pProduktif : totalPokok;
  const taksasiJanjang = Math.round((akpPercent / 100) * calculationBase);
  const taksasiTon = (taksasiJanjang * avgWeightKg) / 1000;
  const kebutuhanPemanen = basisJanjangPerPemanen > 0 ? Math.ceil(taksasiJanjang / basisJanjangPerPemanen) : 0;

  async function addOtherEmployee() {
    const name = otherName.trim();
    if (!name) {
      toast.error('Mohon isi nama karyawan lainnya');
      return;
    }
    try {
      const created = await api.createCustomWorker(name);
      const newEmp: Emp = { _id: String(created._id), name: created.name, role: 'karyawan' };
      setCustomEmployees(prev => [...prev, newEmp]);
      const next = [...selectedIds, newEmp._id];
      setSelectedIds(next);
      await persistSelection(next);
      setOtherName('');
      toast.success('Karyawan lainnya ditambahkan');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal tambah karyawan lainnya');
    }
  }

  async function toggleSelect(id: string) {
    const active = selectedIds.includes(id);
    let next = active ? selectedIds.filter(x => x !== id) : selectedIds;
    if (!active) {
      if (kebutuhanPemanen > 0 && selectedIds.length >= kebutuhanPemanen) {
        toast.error('Kapasitas pemanen sudah terpenuhi');
        return;
      }
      next = [...selectedIds, id];
    }
    setSelectedIds(next);
    await persistSelection(next);
  }

  async function saveRow() {
    if (!date || !estateId || !divisionId || !selectedBlock) {
      toast.error('Mohon lengkapi Tanggal, Estate, Divisi, dan Blok');
      return;
    }
    if (!totalPokok || totalPokok <= 0) {
      toast.error('Blok tidak memiliki data jumlah pokok');
      return;
    }
    const estateName = estates.find((e) => e._id === estateId)?.estate_name || '-';
    const blockLabel = selectedBlock.no_blok || selectedBlock.id_blok || '-';
    const row: TaksasiRow = {
      timestamp: new Date().toISOString(),
      date,
      estateId,
      estateName,
      divisionId,
      blockLabel,
      totalPokok,
      samplePokok,
      bm,
      ptb,
      bmbb,
      bmm,
      avgWeightKg,
      basisJanjangPerPemanen,
      akpPercent: Number(akpPercent.toFixed(2)),
      taksasiJanjang,
      taksasiTon: Number(taksasiTon.toFixed(2)),
      kebutuhanPemanen,
    };

    // Simpan ke server dulu
    try {
      await api.taksasiCreate({
        date,
        estateId,
        division_id: divisionId,
        block_no: blockLabel,
        weightKg: Math.round(taksasiTon * 1000),
        totalPokok,
        samplePokok,
        bm, ptb, bmbb, bmm,
        avgWeightKg,
        basisJanjangPerPemanen,
        akpPercent: row.akpPercent,
        taksasiJanjang,
        taksasiTon: row.taksasiTon,
        kebutuhanPemanen,
        notes: `AKP=${row.akpPercent}%; BH=${bm}; PTB=${ptb}`,
      });

      // Reload dari server untuk memastikan tidak ada duplikat
      const list = await api.taksasiList({ date });
      const mapped: TaksasiRow[] = (list || []).map((doc) => {
        const estateName = estates.find(e => e._id === doc.estateId)?.estate_name || '-';
        return {
          timestamp: doc._id || '',
          date: doc.date ? doc.date.split('T')[0] : date,
          estateId: doc.estateId,
          estateName,
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
          taksasiJanjang: doc.taksasiJanjang ?? Math.round((doc.weightKg || 0) / (doc.avgWeightKg || 15)),
          taksasiTon: doc.taksasiTon ?? (doc.weightKg || 0) / 1000,
          kebutuhanPemanen: doc.kebutuhanPemanen ?? 0,
        };
      });
      setRows(mapped);
      toast.success('Taksasi tersimpan ke server');

      // Simpan selection pekerja yang sudah dialokasikan
      await persistSelection(selectedIds);

      // reset for next input
      setStep(1);
      setDivisionId('');
      setBlocks([]);
      setBlockIndex('');
      setBm(0); setPtb(0); setBmbb(0); setBmm(0);
      setAvgWeightKg(15); setBasisJanjangPerPemanen(120);
      setEditingKey(null);
      setPendingEditBlockLabel('');
      setSelectedIds([]); // Reset selected employees

    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal simpan taksasi ke server';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
      toast.error(msg);
    }
  }

  function nextStep() {
    if (step === 1) {
      if (!date || !estateId || !divisionId || !selectedBlock) {
        toast.error('Mohon lengkapi Tanggal, Estate, Divisi, dan Blok');
        return;
      }
      if (!totalPokok || totalPokok <= 0) {
        toast.error('Blok tidak memiliki data jumlah pokok');
        return;
      }
      setStep(2);
    }
  }

  function resetAll() {
    setStep(1);
    setDate(new Date().toISOString().split('T')[0]);
    setEstateId('');
    setDivisionId('');
    setBlocks([]);
    setBlockIndex('');
    setBm(0); setPtb(0); setBmbb(0); setBmm(0);
    setAvgWeightKg(15); setBasisJanjangPerPemanen(120);
    setSelectedIds([]);
  }

  // When editing, after blocks load try to set blockIndex automatically
  useEffect(() => {
    if (editingKey && pendingEditBlockLabel && blocks.length > 0 && blockIndex === '') {
      const idx = blocks.findIndex(b => (b.no_blok || b.id_blok || '-') === pendingEditBlockLabel);
      if (idx !== -1) setBlockIndex(String(idx));
    }
  }, [editingKey, pendingEditBlockLabel, blocks, blockIndex]);

  function startEdit(row: TaksasiRow) {
    setDate(row.date); // ensure same date
    setEstateId(row.estateId);
    setDivisionId(row.divisionId);
    setPendingEditBlockLabel(row.blockLabel);
    setBm(row.bm);
    setPtb(row.ptb);
    setBmbb(row.bmbb);
    setBmm(row.bmm);
    setAvgWeightKg(row.avgWeightKg);
    setBasisJanjangPerPemanen(row.basisJanjangPerPemanen);
    setStep(2);
    setEditingKey(`${row.date}|${row.estateId}|${row.divisionId}|${row.blockLabel}`);
  }

  const handleExport = async () => {
    try {
      const allData = await api.taksasiList({});
      if (!allData || allData.length === 0) {
        toast.error('Tidak ada data untuk diexport');
        return;
      }

      // Gunakan exceljs untuk styling (center, lebar, freeze). Jika gagal import, fallback ke metode lama.
      let exceljsModule: typeof import('exceljs') | null = null;
      try { exceljsModule = await import('exceljs'); } catch { /* ignore */ }
      if (exceljsModule) {
        const Workbook = exceljsModule.Workbook;
        const wb = new Workbook();
        const ws = wb.addWorksheet('Taksasi', { views: [{ state: 'frozen', ySplit: 2 }] });

        // Header grup + kolom
        const groupHeaders = [
          'Data Input','Data Input','Data Input','Data Input',
          'Master Data Base','Master Data Base','Master Data Base','Master Data Base',
          'Input Data Hasil Sensus AKP Harian',
          'Hasil Perhitungan','Hasil Perhitungan','Hasil Perhitungan','Hasil Perhitungan'
        ];
        const headers = [
          'Tanggal','Estate','Divisi','Blok','Total Pokok','BJR (kg)','Basis (jjg/org)','Sample Pokok',
          'Buah Merah Membrodol (BMM)',
          'AKP %','Taksasi (Janjang)','Taksasi (Ton)','Kebutuhan Pemanen'
        ];

        ws.addRow(groupHeaders);
        ws.addRow(headers);

        // Merge grup
        ws.mergeCells(1,1,1,4); // A1:D1
        ws.mergeCells(1,5,1,8); // E1:H1
        ws.mergeCells(1,9,1,9); // I1:I1
        ws.mergeCells(1,10,1,13); // J1:M1

        // Styling header
        const headerStyle = { alignment: { horizontal: 'center', vertical: 'middle' }, font: { bold: true }, border: { top:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'}, bottom:{style:'thin'} } };
        ws.getRow(1).height = 22;
        ws.getRow(2).height = 20;
        ws.getRow(1).eachCell(cell => { cell.style = headerStyle; });
        ws.getRow(2).eachCell(cell => { cell.style = headerStyle; });

        // Column widths
        const widths = [14,20,10,12,14,10,14,14,30,10,16,14,20];
        widths.forEach((w, i) => { ws.getColumn(i+1).width = w; });

        // Data rows
        for (const r of allData) {
          let formattedDate = r.date;
          if (r.date) {
            const d = new Date(r.date);
            if (!isNaN(d.getTime())) {
              const day = String(d.getDate()).padStart(2,'0');
              const month = String(d.getMonth()+1).padStart(2,'0');
              const year = d.getFullYear();
              formattedDate = `${day}-${month}-${year}`;
            }
          }
          const estateName = estates.find(e => e._id === r.estateId)?.estate_name || '-';
          const akpVal = (r.akpPercent ?? (r.samplePokok && r.samplePokok>0 ? (r.bmm||0)/r.samplePokok*100 : 0));
          const taksasiJanjangVal = r.taksasiJanjang ?? Math.round((akpVal/100)*(r.totalPokok||0));
          const taksasiTonVal = r.taksasiTon ?? (taksasiJanjangVal*(r.avgWeightKg||0))/1000;
          const kebutuhanVal = r.kebutuhanPemanen ?? (r.basisJanjangPerPemanen ? Math.ceil(taksasiJanjangVal / r.basisJanjangPerPemanen) : 0);
          const row = ws.addRow([
            formattedDate,
            estateName,
            r.division_id,
            r.block_no,
            r.totalPokok,
            r.avgWeightKg,
            r.basisJanjangPerPemanen,
            r.samplePokok,
            r.bmm,
            Number(akpVal.toFixed(2)),
            taksasiJanjangVal,
            Number(taksasiTonVal.toFixed(2)),
            kebutuhanVal
          ]);
          row.eachCell(cell => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'}, bottom:{style:'thin'} };
          });
        }

        // Save file
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'Taksasi_All.xlsx'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success('Export berhasil (styled)');
        return;
      }

      // Fallback tanpa styling (xlsx komunitas)
      const groupHeaders = [
        'Data Input','Data Input','Data Input','Data Input',
        'Master Data Base','Master Data Base','Master Data Base','Master Data Base',
        'Input Data Hasil Sensus AKP Harian',
        'Hasil Perhitungan','Hasil Perhitungan','Hasil Perhitungan','Hasil Perhitungan'
      ];
      const headers = [
        'Tanggal','Estate','Divisi','Blok','Total Pokok','BJR (kg)','Basis (jjg/org)','Sample Pokok',
        'Buah Merah Membrodol (BMM)',
        'AKP %','Taksasi (Janjang)','Taksasi (Ton)','Kebutuhan Pemanen'
      ];
      const wbSimple = XLSX.utils.book_new();
      const wsSimple = XLSX.utils.aoa_to_sheet([groupHeaders, headers]);
      let rowIndex = 3;
      for (const r of allData) {
        let formattedDate = r.date;
        if (r.date) {
          const d = new Date(r.date);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2,'0');
            const month = String(d.getMonth()+1).padStart(2,'0');
            const year = d.getFullYear();
            formattedDate = `${day}-${month}-${year}`;
          }
        }
        const estateName = estates.find(e => e._id === r.estateId)?.estate_name || '-';
        const akpVal = (r.akpPercent ?? (r.samplePokok && r.samplePokok>0 ? (r.bmm||0)/r.samplePokok*100 : 0));
        const taksasiJanjangVal = r.taksasiJanjang ?? Math.round((akpVal/100)*(r.totalPokok||0));
        const taksasiTonVal = r.taksasiTon ?? (taksasiJanjangVal*(r.avgWeightKg||0))/1000;
        const kebutuhanVal = r.kebutuhanPemanen ?? (r.basisJanjangPerPemanen ? Math.ceil(taksasiJanjangVal / r.basisJanjangPerPemanen) : 0);
        XLSX.utils.sheet_add_aoa(wsSimple, [[
          formattedDate, estateName, r.division_id, r.block_no, r.totalPokok, r.avgWeightKg, r.basisJanjangPerPemanen,
          r.samplePokok, r.bmm, Number(akpVal.toFixed(2)), taksasiJanjangVal, Number(taksasiTonVal.toFixed(2)), kebutuhanVal
        ]], { origin: { r: rowIndex - 1, c: 0 } });
        rowIndex++;
      }
      wsSimple['!merges'] = [
        { s:{r:0,c:0}, e:{r:0,c:3} },
        { s:{r:0,c:4}, e:{r:0,c:7} },
        { s:{r:0,c:8}, e:{r:0,c:8} },
        { s:{r:0,c:9}, e:{r:0,c:12} }
      ];
      wsSimple['!cols'] = [14,20,10,12,14,10,14,14,22,10,16,14,18].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wbSimple, wsSimple, 'Taksasi');
      XLSX.writeFile(wbSimple, 'Taksasi_All.xlsx');
      toast.success('Export berhasil (tanpa styling penuh)');
    } catch (e) {
      toast.error('Gagal export data');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Detect multi-row header (group header row) and reconstruct data if present
        let data: Record<string, unknown>[];
        const rawMatrix = XLSX.utils.sheet_to_json<(string|number)[]>(ws, { header: 1, blankrows: false });
        if (rawMatrix.length > 1 && typeof rawMatrix[0][0] === 'string' && /(Data Input)/i.test(String(rawMatrix[0][0]))) {
          // Use second row as headers
          const headerRow = rawMatrix[1].map(h => String(h).trim());
          data = rawMatrix.slice(2).map(rArr => {
            const obj: Record<string, unknown> = {};
            headerRow.forEach((h, idx) => { obj[h] = rArr[idx]; });
            return obj;
          });
        } else {
          data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        }

        if (data.length === 0) {
          toast.error('File kosong');
          return;
        }

        const parseDate = (dateStr: unknown): string => {
          if (!dateStr) return date; // fallback to current selected date

          // If it's a number (Excel serial date)
          if (typeof dateStr === 'number') {
            const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }

          const str = String(dateStr).trim();

          // Handle DD-MM-YYYY or DD/MM/YYYY
          if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
            const parts = str.split(/[-/]/);
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
          }

          // Handle YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.split('T')[0];
          }

          return date; // fallback
        };

        const parsedRows: TaksasiRow[] = [];
        const errors: string[] = [];
        const uniqueDates = new Set<string>();

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const getVal = (keys: string[]) => {
            for (const k of keys) if (row[k] !== undefined) return row[k];
            return undefined;
          };

          const rawDate = getVal(['Tanggal', 'Date', 'date']);
          const rowDate = parseDate(rawDate);

          const estateName = getVal(['Estate', 'estate', 'Nama Estate', 'PT']);
          const divisionId = getVal(['Divisi', 'Division', 'division', 'divisi']);
          const blockLabel = getVal(['Blok', 'Block', 'block', 'no_blok']);

          const estate = estates.find(e => e.estate_name.toLowerCase() === String(estateName).toLowerCase() || e._id === estateName);
          if (!estate) {
            errors.push(`Baris ${i + 2}: Estate '${estateName}' tidak ditemukan`);
            continue;
          }

          if (!divisionId || !blockLabel) {
            errors.push(`Baris ${i + 2}: Divisi atau Blok kurang`);
            continue;
          }

          uniqueDates.add(rowDate);

          const bm = Number(getVal(['Buah Hitam (BH)', 'BH', 'bm']) || 0);
          const ptb = Number(getVal(['Pokok Tidak Berbuah (PTB)', 'PTB', 'ptb']) || 0);
          const bmbb = Number(getVal(['Buah Merah Belum Brondol (BMBB)', 'BMBB', 'bmbb']) || 0);
          const bmm = Number(getVal(['Buah Merah Membrodol (BMM)', 'BMM', 'bmm']) || 0);
          const avgWeightKg = Number(getVal(['BJR (kg)', 'BJR', 'avgWeightKg']) || 15);
          const basis = Number(getVal(['Basis (jjg/org)', 'Basis', 'basisJanjangPerPemanen']) || 120);
          const totalPokok = Number(getVal(['Total Pokok', 'Pokok', 'totalPokok']) || 0);

          const samplePokok = Math.max(1, Math.ceil(totalPokok * 0.10));
          const effectiveSample = Math.max(0, samplePokok - ptb);
          const akpPercent = effectiveSample > 0 ? (bmm / effectiveSample) * 100 : 0;
          const nonBearingRate = samplePokok > 0 ? ptb / samplePokok : 0;
          const estimatedNonBearingInBlock = Math.round(nonBearingRate * totalPokok);
          const effectiveBlockPalms = Math.max(0, totalPokok - estimatedNonBearingInBlock);
          const predictedBearingPalms = Math.round((akpPercent / 100) * effectiveBlockPalms);
          const taksasiJanjang = predictedBearingPalms;
          const taksasiTon = (taksasiJanjang * avgWeightKg) / 1000;
          const kebutuhanPemanen = basis > 0 ? Math.ceil(taksasiJanjang / basis) : 0;

          parsedRows.push({
            timestamp: new Date().toISOString(),
            date: rowDate,
            estateId: estate._id,
            estateName: estate.estate_name,
            divisionId: String(divisionId),
            blockLabel: String(blockLabel),
            totalPokok,
            samplePokok,
            bm, ptb, bmbb, bmm,
            avgWeightKg,
            basisJanjangPerPemanen: basis,
            akpPercent: Number(akpPercent.toFixed(2)),
            taksasiJanjang,
            taksasiTon: Number(taksasiTon.toFixed(2)),
            kebutuhanPemanen,
          });
        }

        if (errors.length > 0) {
          toast.error(`Gagal import beberapa baris:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '...' : ''}`);
          if (parsedRows.length === 0) return;
        }

        let existingData: TaksasiRow[] = [];
        for (const d of Array.from(uniqueDates)) {
          const list = await api.taksasiList({ date: d });
          if (list) {
            const mapped = list.map(doc => ({
              timestamp: doc._id || '',
              date: doc.date ? doc.date.split('T')[0] : d,
              estateId: doc.estateId,
              estateName: estates.find(e => e._id === doc.estateId)?.estate_name || '-',
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
              taksasiJanjang: doc.taksasiJanjang ?? 0,
              taksasiTon: doc.taksasiTon ?? 0,
              kebutuhanPemanen: doc.kebutuhanPemanen ?? 0,
            }));
            existingData = [...existingData, ...mapped];
          }
        }

        const newRows: TaksasiRow[] = [];
        const updatedRows: TaksasiRow[] = [];
        const duplicateRows: TaksasiRow[] = [];

        parsedRows.forEach(newRow => {
          const existing = existingData.find(ex =>
            ex.date === newRow.date &&
            ex.estateId === newRow.estateId &&
            String(ex.divisionId) === String(newRow.divisionId) &&
            ex.blockLabel === newRow.blockLabel
          );

          if (existing) {
            const isSame =
              existing.totalPokok === newRow.totalPokok &&
              existing.bm === newRow.bm &&
              existing.ptb === newRow.ptb &&
              existing.bmbb === newRow.bmbb &&
              existing.bmm === newRow.bmm &&
              existing.avgWeightKg === newRow.avgWeightKg &&
              existing.basisJanjangPerPemanen === newRow.basisJanjangPerPemanen;

            if (isSame) {
              duplicateRows.push(newRow);
            } else {
              updatedRows.push(newRow);
            }
          } else {
            newRows.push(newRow);
          }
        });

        setImportPreviewData({ newRows, updatedRows, duplicateRows });
        setIsImportPreviewOpen(true);

      } catch (e) {
        console.error(e);
        toast.error('Gagal membaca file excel');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    if (!importPreviewData) return;
    const { newRows, updatedRows } = importPreviewData;
    const toProcess = [...newRows, ...updatedRows];

    if (toProcess.length === 0) {
      setIsImportPreviewOpen(false);
      return;
    }

    try {
      const payload = toProcess.map(row => ({
        date: row.date,
        estateId: row.estateId,
        division_id: Number(row.divisionId),
        block_no: row.blockLabel,
        weightKg: Math.round(row.taksasiTon * 1000),
        totalPokok: row.totalPokok,
        samplePokok: row.samplePokok,
        bm: row.bm,
        ptb: row.ptb,
        bmbb: row.bmbb,
        bmm: row.bmm,
        avgWeightKg: row.avgWeightKg,
        basisJanjangPerPemanen: row.basisJanjangPerPemanen,
        akpPercent: row.akpPercent,
        taksasiJanjang: row.taksasiJanjang,
        taksasiTon: row.taksasiTon,
        kebutuhanPemanen: row.kebutuhanPemanen,
        notes: `Imported; AKP=${row.akpPercent}%`
      }));

      await api.taksasiCreate(payload);
      toast.success(`Berhasil memproses ${toProcess.length} data`);

      const list = await api.taksasiList({ date });
      const mapped: TaksasiRow[] = (list || []).map((doc) => {
        const estateName = estates.find(e => e._id === doc.estateId)?.estate_name || '-';
        return {
          timestamp: doc._id || '',
          date: doc.date ? doc.date.split('T')[0] : date,
          estateId: doc.estateId,
          estateName,
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
          taksasiJanjang: doc.taksasiJanjang ?? Math.round((doc.weightKg || 0) / (doc.avgWeightKg || 15)),
          taksasiTon: doc.taksasiTon ?? (doc.weightKg || 0) / 1000,
          kebutuhanPemanen: doc.kebutuhanPemanen ?? 0,
        };
      });
      setRows(mapped);
      setIsImportPreviewOpen(false);
      setImportPreviewData(null);
    } catch (e) {
      toast.error('Gagal menyimpan data import');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Taksasi Panen</h1>
          <p className="text-muted-foreground">Form dua langkah untuk prediksi panen</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('import-taksasi')?.click()}
              className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
            </Button>
            <input
              id="import-taksasi"
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          <Button
            size="sm"
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 1: Informasi Blok</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estate</Label>
                <Select value={estateId} onValueChange={setEstateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih estate" />
                  </SelectTrigger>
                  <SelectContent>
                    {estates.map((es) => (
                      <SelectItem key={es._id} value={es._id}>{es.estate_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Divisi</Label>
                <Select value={divisionId} onValueChange={setDivisionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((d) => (
                      <SelectItem key={String(d.division_id)} value={String(d.division_id)}>
                        {typeof d.division_id === 'number' || !String(d.division_id).toLowerCase().startsWith('divisi') 
                          ? `Divisi ${d.division_id}` 
                          : d.division_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blok</Label>
                <Select value={blockIndex} onValueChange={setBlockIndex}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih blok" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks.map((b, idx) => (
                      <SelectItem key={`${b.no_blok ?? idx}`} value={String(idx)}>
                        {b.no_blok ?? b.id_blok ?? `Blok ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Total Pokok</Label>
                <Input readOnly value={totalPokok || '0'} />
              </div>
              <div className="space-y-1">
                <Label>Produktif</Label>
                <Input readOnly className="text-emerald-600 font-bold" value={pProduktif || '0'} />
              </div>
              <div className="space-y-1">
                <Label>Belum Produktif</Label>
                <Input readOnly className="text-orange-600" value={pBelumProduktif || '0'} />
              </div>
              <div className="space-y-1">
                <Label>Mati</Label>
                <Input readOnly className="text-red-600" value={pMati || '0'} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Pokok Sample (10% dari {pProduktif > 0 ? 'Pokok Produktif' : 'Total Pokok'})</Label>
              <Input readOnly value={samplePokok || ''} />
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={nextStep}>Lanjutkan</Button>
            </div>
          </CardContent>
        </Card>
      )
      }

      {
        step === 2 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap gap-4 text-sm font-medium border-b pb-4">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Master:</span>
                  <span title="Total Pokok">TP: {totalPokok}</span>
                  <span title="Pokok Produktif" className="text-emerald-700">PROD: {pProduktif}</span>
                  <span title="Pokok Belum Produktif" className="text-orange-700">B.PROD: {pBelumProduktif}</span>
                  <span title="Pokok Mati" className="text-red-700">MATI: {pMati}</span>
                </div>
                <div className="flex gap-2 border-l pl-4">
                  <span className="text-muted-foreground">Target Sample:</span>
                  <span className="font-bold">{samplePokok} Pohon</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Pokok Sampel Sensus</Label>
                  <Input readOnly value={samplePokok} className="bg-muted" />
                  <p className="text-[10px] text-muted-foreground italic">10% dari Pokok Produktif</p>
                </div>
                <div className="space-y-2">
                  <Label>Pokok Matang (BMM)</Label>
                  <Input type="number" min={0} value={bmm} onChange={(e) => setBmm(Number(e.target.value || 0))} />
                  <p className="text-[10px] text-muted-foreground italic">Jumlah janjang masak ditemukan</p>
                </div>
                <div className="space-y-2">
                  <Label>Berat Janjang Rata-rata (kg)</Label>
                  <Input type="number" min={0} step="0.1" value={avgWeightKg} onChange={(e) => setAvgWeightKg(Number(e.target.value || 0))} />
                </div>
                <div className="space-y-2">
                  <Label>Basis Blok (janjang/pemanen)</Label>
                  <Input type="number" min={1} value={basisJanjangPerPemanen} onChange={(e) => setBasisJanjangPerPemanen(Number(e.target.value || 0))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-emerald-700 font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Hasil Perhitungan Taksasi
                </Label>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase">AKP %</div>
                    <div className="text-2xl font-bold text-emerald-700">{akpPercent.toFixed(2)}%</div>
                    <div className="text-[10px] text-muted-foreground">BMM / Sample</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Taksasi Janjang</div>
                    <div className="text-2xl font-bold text-emerald-700">{taksasiJanjang} <span className="text-sm font-normal text-muted-foreground uppercase">jjg</span></div>
                    <div className="text-[10px] text-muted-foreground">AKP% * P.Produktif</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Estimasi Tonase</div>
                    <div className="text-2xl font-bold text-emerald-700">{taksasiTon.toFixed(2)} <span className="text-sm font-normal text-muted-foreground uppercase">ton</span></div>
                    <div className="text-[10px] text-muted-foreground">{avgWeightKg} kg/jjg</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Karya Pemanen</div>
                    <div className="text-2xl font-bold text-emerald-700">{kebutuhanPemanen} <span className="text-sm font-normal text-muted-foreground uppercase">org</span></div>
                    <div className="text-[10px] text-muted-foreground">Basis {basisJanjangPerPemanen} jjg</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Catatan: Perhitungan ini disesuaikan dengan <strong>Master Data Aresta 2026</strong>. AKP dihitung langsung dari perbandingan BMM terhadap Sampel pada populasi Pokok Produktif.
                </p>
              </div>

              {/* Employee selection dialog */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">Alokasi Pemanen</div>
                  <div className="text-muted-foreground">Pilih karyawan sesuai kebutuhan: <span className="font-mono">{selectedIds.length}/{kebutuhanPemanen}</span></div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Pilih Karyawan</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Pilih Karyawan ({selectedIds.length}/{kebutuhanPemanen})</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-auto">
                      {allEmployees.map((emp) => {
                        const active = selectedIds.includes(emp._id);
                        const atCapacity = !active && kebutuhanPemanen > 0 && selectedIds.length >= kebutuhanPemanen;
                        return (
                          <div
                            key={emp._id}
                            role="button"
                            aria-pressed={active}
                            onClick={() => !atCapacity && toggleSelect(emp._id)}
                            className={`rounded-lg border p-3 transition ${active ? 'bg-emerald-50 border-emerald-300' : 'hover:bg-muted'} ${atCapacity ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="font-medium truncate">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {emp.division 
                                ? (!emp.division.toLowerCase().startsWith('divisi') 
                                  ? `Divisi ${emp.division}` 
                                  : emp.division)
                                : '-'}
                            </div>
                            {active && <div className="mt-2 inline-block text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Dipilih</div>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label className="text-sm font-medium">Tambah Karyawan Lain (Other)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nama karyawan baru"
                          value={otherName}
                          onChange={(e) => setOtherName(e.target.value)}
                          className="flex-1"
                        />
                        <Button variant="secondary" onClick={addOtherEmployee}>Tambah</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Hanya isi nama. Kolom divisi mengikuti konteks pilihan saat ini.
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">Tidak dapat memilih lebih dari kapasitas.</div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => {
                    // For now we don't persist; we just show a confirmation
                    toast.success('Taksasi dihitung. Anda dapat menyimpan fitur ini nanti.');
                  }}>Hitung Ulang</Button>
                  <Button onClick={saveRow}>Selesai</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      }

      {/* Table of saved rows for the selected date */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tabel Taksasi Hari Ini ({date})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data tersimpan untuk tanggal ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estate</TableHead>
                  <TableHead>Divisi</TableHead>
                  <TableHead>Blok</TableHead>
                  <TableHead className="text-right">Pokok</TableHead>
                  <TableHead className="text-right">Sample</TableHead>
                  <TableHead className="text-right">BH</TableHead>
                  <TableHead className="text-right">PTB</TableHead>
                  <TableHead className="text-right">BMBB</TableHead>
                  <TableHead className="text-right">BMM</TableHead>
                  <TableHead className="text-right">AKP %</TableHead>
                  <TableHead className="text-right">Ton</TableHead>
                  <TableHead className="text-right">Perkiraan Kg</TableHead>
                  <TableHead className="text-right">Pemanen</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.timestamp + i}>
                    <TableCell>{r.estateName}</TableCell>
                    <TableCell>
                      {!r.divisionId.toLowerCase().startsWith('divisi') 
                        ? `Divisi ${r.divisionId}` 
                        : r.divisionId}
                    </TableCell>
                    <TableCell>{r.blockLabel}</TableCell>
                    <TableCell className="text-right">{r.totalPokok}</TableCell>
                    <TableCell className="text-right">{r.samplePokok}</TableCell>
                    <TableCell className="text-right">{r.bm}</TableCell>
                    <TableCell className="text-right">{r.ptb}</TableCell>
                    <TableCell className="text-right">{r.bmbb}</TableCell>
                    <TableCell className="text-right">{r.bmm}</TableCell>
                    <TableCell className="text-right">{r.akpPercent.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.taksasiTon.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Math.round(r.taksasiTon * 1000)}</TableCell>
                    <TableCell className="text-right">{r.kebutuhanPemanen}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Preview Dialog */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Import Taksasi</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Data Baru</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{importPreviewData?.newRows.length || 0}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Update</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-blue-600">{importPreviewData?.updatedRows.length || 0}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Duplikat (Diabaikan)</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-gray-400">{importPreviewData?.duplicateRows.length || 0}</div></CardContent>
              </Card>
            </div>

            {importPreviewData?.newRows.length ? (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700"><div className="w-2 h-2 rounded-full bg-green-600" /> Data Baru (Akan Ditambahkan)</h3>
                <div className="border rounded-md overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Estate</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Blok</TableHead>
                        <TableHead className="text-right">Taksasi (Ton)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.newRows.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.estateName}</TableCell>
                          <TableCell>Divisi {r.divisionId}</TableCell>
                          <TableCell>{r.blockLabel}</TableCell>
                          <TableCell className="text-right">{r.taksasiTon.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {importPreviewData.newRows.length > 50 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">... dan {importPreviewData.newRows.length - 50} data lainnya</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {importPreviewData?.updatedRows.length ? (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-700"><div className="w-2 h-2 rounded-full bg-blue-600" /> Data Update (Akan Diperbarui)</h3>
                <div className="border rounded-md overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Estate</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Blok</TableHead>
                        <TableHead className="text-right">Taksasi Baru (Ton)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.updatedRows.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.estateName}</TableCell>
                          <TableCell>Divisi {r.divisionId}</TableCell>
                          <TableCell>{r.blockLabel}</TableCell>
                          <TableCell className="text-right">{r.taksasiTon.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {importPreviewData?.duplicateRows.length ? (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-gray-500"><div className="w-2 h-2 rounded-full bg-gray-400" /> Data Duplikat (Sama Persis - Diabaikan)</h3>
                <div className="border rounded-md overflow-auto max-h-40 bg-muted/30">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Estate</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Blok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.duplicateRows.slice(0, 20).map((r, i) => (
                        <TableRow key={i} className="opacity-60">
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.estateName}</TableCell>
                          <TableCell>Divisi {r.divisionId}</TableCell>
                          <TableCell>{r.blockLabel}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsImportPreviewOpen(false)}>Batal</Button>
            <Button
              onClick={confirmImport}
              disabled={!importPreviewData || (importPreviewData.newRows.length === 0 && importPreviewData.updatedRows.length === 0)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Proses Import ({((importPreviewData?.newRows.length || 0) + (importPreviewData?.updatedRows.length || 0))})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
