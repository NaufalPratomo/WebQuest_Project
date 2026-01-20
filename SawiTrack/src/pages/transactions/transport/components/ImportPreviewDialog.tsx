/**
 * Import Preview Dialog Component
 * Shows preview of Excel data before import
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ImportPreviewDialogProps } from "../types";

export function ImportPreviewDialog({
  isOpen,
  onClose,
  onConfirm,
  data,
  isLoading,
}: ImportPreviewDialogProps) {
  // Debug log
  console.log(
    "📋 ImportPreviewDialog rendered with data:",
    data.length,
    "rows",
  );
  if (data.length > 0) {
    console.log("🔍 First row in dialog:", data[0]);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Preview Import Data</DialogTitle>
          <DialogDescription>
            {data.length > 0
              ? `Ditemukan ${data.length} baris data. Periksa data sebelum mengimport.`
              : "Tidak ada data valid yang ditemukan dalam file Excel."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] w-full rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 bg-background">No</TableHead>
                <TableHead className="sticky top-0 bg-background">PT</TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Tanggal
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Divisi
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Driver
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  No. Mobil
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  No. SPB
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Block
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Tahun
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Jumlah
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Brondolan
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Berat Di
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  No. Tiket
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Code
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Bruto
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Tarra
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Netto
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Potongan
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Berat /Block
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  Tonase/Pengiriman
                </TableHead>
                <TableHead className="sticky top-0 bg-background">
                  JJG/
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={24}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Tidak ada data untuk ditampilkan
                  </TableCell>
                </TableRow>
              )}
              {data.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{row.pt || "-"}</TableCell>
                  <TableCell>
                    {row.date_angkut
                      ? String(row.date_angkut).slice(0, 10)
                      : "-"}
                  </TableCell>
                  <TableCell>{row.division_id || "-"}</TableCell>
                  <TableCell>{row.nama_supir || "-"}</TableCell>
                  <TableCell>{row.no_mobil || "-"}</TableCell>
                  <TableCell>{row.no_spb || "-"}</TableCell>
                  <TableCell>{row.block_no || "-"}</TableCell>
                  <TableCell>{row.tahun || "-"}</TableCell>
                  <TableCell>{row.jumlah || "-"}</TableCell>
                  <TableCell>{row.brondolan || "-"}</TableCell>
                  <TableCell>{row.beratDiKirim || "-"}</TableCell>
                  <TableCell>{row.no_tiket || "-"}</TableCell>
                  <TableCell>{row.code || "-"}</TableCell>
                  <TableCell>{row.bruto || "-"}</TableCell>
                  <TableCell>{row.tarra || "-"}</TableCell>
                  <TableCell>{row.netto || "-"}</TableCell>
                  <TableCell>{row.potongan || "-"}</TableCell>
                  <TableCell>{row.berat || "-"}</TableCell>
                  <TableCell>{row.tonase || "-"}</TableCell>
                  <TableCell>{row.jjg || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Mengimport..." : `Import ${data.length} Data`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
