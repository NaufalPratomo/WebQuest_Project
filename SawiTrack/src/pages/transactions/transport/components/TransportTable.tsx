/**
 * Transport Table Component
 * Displays transport data with pagination
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TransportTableProps } from "../types";

// Helper to extract note value
function noteVal(notes: string | undefined, key: string): string {
  if (!notes) return "";
  const pairs = notes
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const p of pairs) {
    const [k, v] = p.split("=");
    if (k?.trim().toLowerCase() === key.toLowerCase()) {
      return v?.trim() || "";
    }
  }
  return "";
}

export function TransportTable({
  data,
  pagination,
  onPageChange,
  onRowEdit,
  onRowDelete,
}: TransportTableProps) {
  const { currentPage, totalPages, startIndex, endIndex } = pagination;

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center whitespace-nowrap">
                PT
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Tanggal
              </TableHead>
              {/* <TableHead className="text-center whitespace-nowrap">
                Estate
              </TableHead> */}
              <TableHead className="text-center whitespace-nowrap">
                Divisi
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Driver
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                No. Kendaraan
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                No SPB
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Block
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Tahun
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Jumlah
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Brondolan (kg)
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Berat Di Kirim (kg)
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                No. Tiket
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Code
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                BRUTO (kg)
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                TARRA (kg)
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                NETTO (kg)
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                POTONGAN
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Berat
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                TONASE
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">
                Janjang
              </TableHead>

              {/* <TableHead className="text-center whitespace-nowrap">
                Restan
              </TableHead> */}
              <TableHead className="text-center whitespace-nowrap">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={23}
                  className="text-center text-sm text-muted-foreground"
                >
                  Tidak ada data
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-center whitespace-nowrap">
                    {row.companyName || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {row.date_angkut
                      ? String(row.date_angkut)
                          .slice(0, 10)
                          .split("-")
                          .reverse()
                          .join("-")
                      : "-"}
                  </TableCell>
                  {/* <TableCell className="text-center whitespace-nowrap">
                    {row.estateName || "-"}
                  </TableCell> */}
                  <TableCell className="text-center whitespace-nowrap">
                    {typeof row.division_id === "number"
                      ? `Divisi ${row.division_id}`
                      : row.division_id}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "nama_supir") ||
                      noteVal(row.notes, "supir") ||
                      "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "no_mobil") || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {row.no_spb || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {row.block_no}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "tahun") || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {row.jumlah || 0}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "brondolan") || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "beratdikirim") ||
                      noteVal(row.notes, "berat_di") ||
                      "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "no_tiket") || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "code") || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "bruto")
                      ? Math.round(
                          parseFloat(
                            noteVal(row.notes, "bruto").replace(",", "."),
                          ),
                        ).toLocaleString("id-ID")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "tarra")
                      ? Math.round(
                          parseFloat(
                            noteVal(row.notes, "tarra").replace(",", "."),
                          ),
                        ).toLocaleString("id-ID")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "netto")
                      ? Math.round(
                          parseFloat(
                            noteVal(row.notes, "netto").replace(",", "."),
                          ),
                        ).toLocaleString("id-ID")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "potongan") ||
                    noteVal(row.notes, "poto")
                      ? Math.round(
                          parseFloat(
                            (
                              noteVal(row.notes, "potongan") ||
                              noteVal(row.notes, "poto")
                            ).replace(",", "."),
                          ),
                        ).toLocaleString("id-ID")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "berat")
                      ? Math.round(
                          parseFloat(
                            noteVal(row.notes, "berat").replace(",", "."),
                          ),
                        ).toLocaleString("id-ID")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "tonase") || "-"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {noteVal(row.notes, "jjg") || "-"}
                  </TableCell>

                  {/* <TableCell className="text-center whitespace-nowrap">
                    - RESTAN
                  </TableCell> */}
                  <TableCell className="text-center whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRowEdit(row)}
                    >
                      {(() => {
                        // Check if critical fields are filled
                        const hasNoMobil = noteVal(row.notes, "no_mobil");
                        const hasNamaSupir =
                          noteVal(row.notes, "nama_supir") ||
                          noteVal(row.notes, "supir");
                        const hasBruto = noteVal(row.notes, "bruto");
                        const hasTarra = noteVal(row.notes, "tarra");
                        const hasNetto = noteVal(row.notes, "netto");

                        // If any critical field is missing, show "Lengkapi"
                        if (
                          !hasNoMobil ||
                          !hasNamaSupir ||
                          !hasBruto ||
                          !hasTarra ||
                          !hasNetto
                        ) {
                          return "Lengkapi";
                        }
                        return "Edit";
                      })()}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Menampilkan {startIndex + 1} - {endIndex} dari {data.length} data
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const showPage =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1);

              if (!showPage) {
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-2">
                      ...
                    </span>
                  );
                }
                return null;
              }

              return (
                <Button
                  key={page}
                  size="sm"
                  variant={currentPage === page ? "default" : "outline"}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              );
            })}

            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
