import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useManifestacoes } from "@/hooks/useOuvidoria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  MessageSquare, 
  MoreHorizontal,
  Eye,
  UserCheck,
  Forward,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ManifestacaoFilters } from "@/types/ouvidoria";
import { TIPO_MANIFESTACAO_LABELS, STATUS_LABELS, PRIORIDADE_LABELS } from "@/types/ouvidoria";
import { StatusBadge } from "@/components/ouvidoria/StatusBadge";
import { PrioridadeBadge } from "@/components/ouvidoria/PrioridadeBadge";
import { TipoBadge } from "@/components/ouvidoria/TipoBadge";
import { EncaminharModal } from "@/components/ouvidoria/EncaminharModal";
import { toast } from "sonner";

export default function ManifestacoesList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ManifestacaoFilters>({});
  const [tab, setTab] = useState("todas");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [encaminharOpen, setEncaminharOpen] = useState(false);
  const [encaminharId, setEncaminharId] = useState("");

  const { data: manifestacoes, isLoading } = useManifestacoes({
    ...filters,
    search: search || undefined,
  });

  // Contagem por tab (mock)
  const counts = {
    todas: manifestacoes?.length || 0,
    minhas: 12,
    sem_responsavel: 8,
    atrasadas: 3,
  };

  const handleFilterChange = (key: keyof ManifestacaoFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "todos" ? undefined : value,
    }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === manifestacoes?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(manifestacoes?.map(m => m.id) || []);
    }
  };

  const getSLABadge = (createdAt: string, dataLimite: string | null) => {
    if (!dataLimite) return null;
    
    const horasRestantes = differenceInHours(new Date(dataLimite), new Date());
    
    if (horasRestantes < 0) {
      const horasAtrasado = Math.abs(horasRestantes);
      return (
        <Badge className="bg-red-100 text-red-700 border-0">
          Atrasado {horasAtrasado}h
        </Badge>
      );
    } else if (horasRestantes <= 4) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-0">
          {horasRestantes}h restantes
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-100 text-green-700 border-0">
          {horasRestantes}h restantes
        </Badge>
      );
    }
  };

  const handleAssumir = (id: string) => {
    toast.success("Manifestação assumida");
  };

  const handleMarcarUrgente = (id: string) => {
    toast.success("Marcada como urgente");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fila de Manifestações</h1>
        <p className="text-muted-foreground">
          Gerencie as manifestações da ouvidoria
        </p>
      </div>

      {/* Filtros inline */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por protocolo ou assunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.tipo || "todos"}
          onValueChange={(value) => handleFilterChange("tipo", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
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

        <Select
          value={filters.status || "todos"}
          onValueChange={(value) => handleFilterChange("status", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
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

        <Select
          value={filters.prioridade || "todos"}
          onValueChange={(value) => handleFilterChange("prioridade", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {Object.entries(PRIORIDADE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todas">
            Todas ({counts.todas})
          </TabsTrigger>
          <TabsTrigger value="minhas">
            Minhas ({counts.minhas})
          </TabsTrigger>
          <TabsTrigger value="sem_responsavel">
            Sem responsável ({counts.sem_responsavel})
          </TabsTrigger>
          <TabsTrigger value="atrasadas" className="text-red-600">
            Atrasadas ({counts.atrasadas})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : manifestacoes?.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Nenhuma manifestação encontrada</h3>
          <p className="text-sm">Tente ajustar os filtros de busca</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.length === manifestacoes?.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manifestacoes?.map((m) => (
                  <TableRow 
                    key={m.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/ouvidoria/${m.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(m.id)}
                        onCheckedChange={() => toggleSelect(m.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {m.protocolo}
                    </TableCell>
                    <TableCell>
                      {m.anonimo ? (
                        <span className="text-muted-foreground italic">Anônimo</span>
                      ) : (
                        m.associado?.nome || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <TipoBadge tipo={m.tipo} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {m.assunto}
                    </TableCell>
                    <TableCell>
                      <PrioridadeBadge prioridade={m.prioridade} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell>
                      {m.responsavel?.nome || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getSLABadge(m.created_at, m.data_limite)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/ouvidoria/${m.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver
                          </DropdownMenuItem>
                          {!m.responsavel_id && (
                            <DropdownMenuItem onClick={() => handleAssumir(m.id)}>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Assumir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            setEncaminharId(m.id);
                            setEncaminharOpen(true);
                          }}>
                            <Forward className="h-4 w-4 mr-2" />
                            Encaminhar
                          </DropdownMenuItem>
                          {m.prioridade !== 'urgente' && (
                            <DropdownMenuItem onClick={() => handleMarcarUrgente(m.id)}>
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Marcar urgente
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {manifestacoes?.length} de {manifestacoes?.length} manifestações
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
              >
                {page}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Modal Encaminhar */}
      <EncaminharModal
        open={encaminharOpen}
        onOpenChange={setEncaminharOpen}
        manifestacaoId={encaminharId}
      />
    </div>
  );
}
