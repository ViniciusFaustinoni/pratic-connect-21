import { useState } from "react";
import { useManifestacoes } from "@/hooks/useOuvidoria";
import { ManifestacaoCard } from "@/components/ouvidoria/ManifestacaoCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Search, MessageSquare, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ManifestacaoFilters, TipoManifestacao, StatusManifestacao, PrioridadeManifestacao } from "@/types/ouvidoria";
import { TIPO_MANIFESTACAO_LABELS, STATUS_LABELS, PRIORIDADE_LABELS } from "@/types/ouvidoria";
import { Label } from "@/components/ui/label";

export default function ManifestacoesList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ManifestacaoFilters>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: manifestacoes, isLoading } = useManifestacoes({
    ...filters,
    search: search || undefined,
  });

  const handleFilterChange = (key: keyof ManifestacaoFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "todos" ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ouvidoria")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Manifestações</h1>
          <p className="text-muted-foreground">
            {manifestacoes?.length || 0} manifestações encontradas
          </p>
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por protocolo ou assunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Refine a busca de manifestações</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 mt-6">
              {/* Tipo */}
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={filters.tipo || "todos"}
                  onValueChange={(value) => handleFilterChange("tipo", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    {Object.entries(TIPO_MANIFESTACAO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status || "todos"}
                  onValueChange={(value) => handleFilterChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prioridade */}
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={filters.prioridade || "todos"}
                  onValueChange={(value) => handleFilterChange("prioridade", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as prioridades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as prioridades</SelectItem>
                    {Object.entries(PRIORIDADE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    clearFilters();
                    setSheetOpen(false);
                  }}
                >
                  Limpar
                </Button>
                <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : manifestacoes?.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Nenhuma manifestação encontrada</h3>
          <p className="text-sm">Tente ajustar os filtros de busca</p>
        </div>
      ) : (
        <div className="space-y-3">
          {manifestacoes?.map((manifestacao) => (
            <ManifestacaoCard key={manifestacao.id} manifestacao={manifestacao} />
          ))}
        </div>
      )}
    </div>
  );
}
