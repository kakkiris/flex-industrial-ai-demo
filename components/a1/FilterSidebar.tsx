"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type SearchFilters = {
  submarkets: string[];
  minSqft: number;
  maxSqft: number;
  assetType: string | null;
  leaseType: string | null;
  // Added 2026-05-27 per audit P2.8
  hasBathroom: "yes" | "no" | null;
  hasOffice: "yes" | "no" | null;
  tenantCategories: string[];
  clearHeightMin: number;
  clearHeightMax: number;
};

type Props = {
  value: SearchFilters;
  onChange: (filters: SearchFilters) => void;
};

const CLEAR_HEIGHT_FLOOR = 10;
const CLEAR_HEIGHT_CEILING = 36;

function YesNoSelect({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: "yes" | "no" | null;
  onValueChange: (v: "yes" | "no" | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value ?? "__any__"}
        onValueChange={(v) =>
          onValueChange(v === "__any__" ? null : (v as "yes" | "no"))
        }
      >
        <SelectTrigger className="w-full h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any__">(any)</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function FilterSidebar({ value, onChange }: Props) {
  const [local, setLocal] = useState<SearchFilters>(value);

  const { data: submarkets = [] } = useQuery({
    queryKey: ["submarkets"],
    queryFn: async () => {
      const res = await fetch("/api/submarkets");
      const json = await res.json();
      return (json.data as string[]) ?? [];
    },
  });

  const { data: tenantCategories = [] } = useQuery({
    queryKey: ["tenant-categories"],
    queryFn: async () => {
      const res = await fetch("/api/tenant-categories");
      const json = await res.json();
      return (json.data as string[]) ?? [];
    },
  });

  function toggleSubmarket(name: string) {
    setLocal((prev) => {
      const already = prev.submarkets.includes(name);
      return {
        ...prev,
        submarkets: already
          ? prev.submarkets.filter((s) => s !== name)
          : [...prev.submarkets, name],
      };
    });
  }

  function toggleCategory(name: string) {
    setLocal((prev) => {
      const already = prev.tenantCategories.includes(name);
      return {
        ...prev,
        tenantCategories: already
          ? prev.tenantCategories.filter((s) => s !== name)
          : [...prev.tenantCategories, name],
      };
    });
  }

  function handleSqftChange(vals: number | readonly number[]) {
    if (typeof vals === "number") return;
    const [min, max] = vals;
    setLocal((prev) => ({
      ...prev,
      minSqft: min !== undefined ? min : prev.minSqft,
      maxSqft: max !== undefined ? max : prev.maxSqft,
    }));
  }

  function handleClearHeightChange(vals: number | readonly number[]) {
    if (typeof vals === "number") return;
    const [min, max] = vals;
    setLocal((prev) => ({
      ...prev,
      clearHeightMin: min !== undefined ? min : prev.clearHeightMin,
      clearHeightMax: max !== undefined ? max : prev.clearHeightMax,
    }));
  }

  function handleSearch() {
    onChange(local);
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Submarkets
        </p>
        {submarkets.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Loading…</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {submarkets.map((sub) => (
              <label key={sub} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={local.submarkets.includes(sub)}
                  onCheckedChange={() => toggleSubmarket(sub)}
                />
                <span className="text-sm">{sub}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Suite Size (sqft)
        </p>
        <Slider
          min={500}
          max={12000}
          step={100}
          value={[local.minSqft, local.maxSqft]}
          onValueChange={handleSqftChange}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{local.minSqft.toLocaleString()}</span>
          <span>{local.maxSqft.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <YesNoSelect
          label="Bathroom"
          value={local.hasBathroom}
          onValueChange={(v) => setLocal((prev) => ({ ...prev, hasBathroom: v }))}
        />
        <YesNoSelect
          label="Office"
          value={local.hasOffice}
          onValueChange={(v) => setLocal((prev) => ({ ...prev, hasOffice: v }))}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Clear Height (ft)
        </p>
        <Slider
          min={CLEAR_HEIGHT_FLOOR}
          max={CLEAR_HEIGHT_CEILING}
          step={1}
          value={[local.clearHeightMin, local.clearHeightMax]}
          onValueChange={handleClearHeightChange}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{local.clearHeightMin} ft</span>
          <span>{local.clearHeightMax} ft</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Asset Type
        </Label>
        <Select
          value={local.assetType ?? "__any__"}
          onValueChange={(v) =>
            setLocal((prev) => ({
              ...prev,
              assetType: v === "__any__" ? null : v,
            }))
          }
        >
          <SelectTrigger className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">(any)</SelectItem>
            <SelectItem value="flex industrial">flex industrial</SelectItem>
            <SelectItem value="Industrial">Industrial</SelectItem>
            <SelectItem value="Flex/Industrial">Flex/Industrial</SelectItem>
            <SelectItem value="warehouse">warehouse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lease Type
        </Label>
        <Select
          value={local.leaseType ?? "__any__"}
          onValueChange={(v) =>
            setLocal((prev) => ({
              ...prev,
              leaseType: v === "__any__" ? null : v,
            }))
          }
        >
          <SelectTrigger className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">(any)</SelectItem>
            <SelectItem value="NNN">NNN</SelectItem>
            <SelectItem value="MG">MG</SelectItem>
            <SelectItem value="Gross">Gross</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tenant Category
        </p>
        {tenantCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No categories yet.</p>
        ) : (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {tenantCategories.map((cat) => (
              <label key={cat} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={local.tenantCategories.includes(cat)}
                  onCheckedChange={() => toggleCategory(cat)}
                />
                <span className="text-xs">{cat}</span>
              </label>
            ))}
          </div>
        )}
        {local.tenantCategories.length > 0 && (
          <p className="text-[10.5px] text-muted-foreground leading-snug">
            Legacy units with pending-capture category are not matched by a category filter.
          </p>
        )}
      </div>

      <Button className="w-full mt-1" onClick={handleSearch}>
        Search
      </Button>
    </div>
  );
}
