/**
 * Transport Filters Component
 * Handles search and filtering controls
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { TransportFiltersProps } from "../types";

export function TransportFilters({
  filters,
  onFiltersChange,
  companies,
  estates,
  divisions,
}: TransportFiltersProps) {
  const filteredEstates = filters.selectedCompanyId
    ? estates.filter((e) => e.companyId === filters.selectedCompanyId)
    : estates;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">Cari</Label>
        <Input
          id="search"
          placeholder="Cari data..."
          value={filters.searchTerm}
          onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
        />
      </div>

      {/* PT Filter */}
      <div className="space-y-2">
        <Label htmlFor="company">PT</Label>
        <Select
          value={filters.selectedCompanyId}
          onValueChange={(val) =>
            onFiltersChange({
              selectedCompanyId: val,
              selectedEstateId: "", // Reset estate when company changes
              selectedDivisionId: "", // Reset division when company changes
            })
          }
        >
          <SelectTrigger id="company">
            <SelectValue placeholder="Semua PT" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua PT</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Division Filter */}
      <div className="space-y-2">
        <Label htmlFor="division">Divisi</Label>
        <Select
          value={filters.selectedDivisionId}
          onValueChange={(val) => onFiltersChange({ selectedDivisionId: val })}
          disabled={
            !filters.selectedCompanyId || filters.selectedCompanyId === "ALL"
          }
        >
          <SelectTrigger id="division">
            <SelectValue placeholder="Semua Divisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Divisi</SelectItem>
            {divisions.map((div) => (
              <SelectItem key={div} value={div}>
                Divisi {div}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Filter */}
      <div className="space-y-2">
        <Label>Tanggal</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.startDate ? (
                format(filters.startDate, "PPP")
              ) : (
                <span>Pilih tanggal</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.startDate}
              onSelect={(date) => {
                // Set both startDate and endDate to the same date
                onFiltersChange({
                  startDate: date,
                  endDate: date,
                });
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
