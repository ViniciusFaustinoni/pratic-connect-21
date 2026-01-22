import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { 
  History, 
  Search, 
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  XCircle,
  Wrench,
  RotateCcw,
  RefreshCw,
  UserPlus,
  UserMinus
} from "lucide-react";

// Configuração de tipos de movimentação
const tipoConfig: Record<string, { 
  label: string; 
  icon: typeof ArrowDownCircle;
  bgColor: string; 
  textColor: string;
}> = {
  entrada: { 
    label: "Entrada", 
    icon: ArrowDownCircle,
    bgColor: "bg-green-100", 
    textColor: "text-green-800" 
  },
  saida: { 
    label: "Saída", 
    icon: ArrowUpCircle,
    bgColor: "bg-blue-100", 
    textColor: "text-blue-800" 
  },
  transferencia: { 
    label: "Transferência", 
    icon: ArrowRightLeft,
    bgColor: "bg-purple-100", 
    textColor: "text-purple-800" 
  },
  baixa: { 
    label: "Baixa", 
    icon: XCircle,
    bgColor: "bg-red-100", 
    textColor: "text-red-800" 
  },
  manutencao: { 
    label: "Manutenção", 
    icon: Wrench,
    bgColor: "bg-yellow-100", 
    textColor: "text-yellow-800" 
  },
  retorno_manutencao: { 
    label: "Retorno Man.", 
    icon: RotateCcw,
    bgColor: "bg-indigo-100", 
    textColor: "text-indigo-800" 
  },
  atribuicao_portador: { 
    label: "Atribuição", 
    icon: UserPlus,
    bgColor: "bg-violet-100", 
    textColor: "text-violet-800" 
  },
  remocao_portador: { 
    label: "Rem. Portador", 
    icon: UserMinus,
    bgColor: "bg-orange-100", 
    textColor: "text-orange-800" 
  },
};

interface Movimentacao {
  id: string;
  created_at: string;
  tipo: string;
  quantidade: number;
  status_anterior: string | null;
  status_novo: string | null;
  nota_fiscal: string | null;
  fornecedor: string | null;
  observacoes: string | null;
  rastreador: {
    id: string;
    codigo: string;
    plataforma: string;
  } | null;
  usuario: {
    id: string;
    nome: string;
  } | null;
}

export function HistoricoMovimentacoes() {
  // Estados dos filtros
  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroBusca, setFiltroBusca] = useState("");

  // Query para buscar movimentações
  const { data: movimentacoes, isLoading, refetch } = useQuery({
    queryKey: ["estoque-movimentacoes", filtroTipo, filtroDataInicio, filtroDataFim],
    queryFn: async () => {
      let query = supabase
        .from("estoque_movimentacoes")
        .select(`
          *,
          rastreador:rastreadores(id, codigo, plataforma),
          usuario:profiles!estoque_movimentacoes_usuario_id_fkey(id, nome)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      // Filtro por tipo
      if (filtroTipo && filtroTipo !== "todas") {
        query = query.eq("tipo", filtroTipo);
      }

      // Filtro por data início
      if (filtroDataInicio) {
        query = query.gte("created_at", `${filtroDataInicio}T00:00:00`);
      }

      // Filtro por data fim
      if (filtroDataFim) {
        query = query.lte("created_at", `${filtroDataFim}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Movimentacao[];
    },
  });

  // Filtrar por busca no frontend (código do rastreador ou nota fiscal)
  const movimentacoesFiltradas = movimentacoes?.filter((mov) => {
    if (!filtroBusca) return true;
    
    const termo = filtroBusca.toLowerCase();
    const codigo = mov.rastreador?.codigo?.toLowerCase() || "";
    const notaFiscal = mov.nota_fiscal?.toLowerCase() || "";
    const fornecedor = mov.fornecedor?.toLowerCase() || "";
    
    return codigo.includes(termo) || 
           notaFiscal.includes(termo) || 
           fornecedor.includes(termo);
  }) || [];

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroTipo("todas");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroBusca("");
  };

  // Verificar se há filtros ativos
  const temFiltrosAtivos = filtroTipo !== "todas" || 
                          filtroDataInicio !== "" || 
                          filtroDataFim !== "" || 
                          filtroBusca !== "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Histórico de Movimentações
          </CardTitle>
          <div className="flex items-center gap-2">
            {temFiltrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtros:</span>
          </div>

          {/* Filtro por Tipo */}
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="manutencao">Manutenção</SelectItem>
              <SelectItem value="retorno_manutencao">Retorno Man.</SelectItem>
              <SelectItem value="atribuicao_portador">Atribuição</SelectItem>
              <SelectItem value="remocao_portador">Rem. Portador</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por Período */}
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="w-[140px] h-9"
              placeholder="De"
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="w-[140px] h-9"
              placeholder="Até"
            />
          </div>

          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar código, NF ou fornecedor..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            "Carregando..."
          ) : (
            `${movimentacoesFiltradas.length} movimentação(ões) encontrada(s)`
          )}
        </div>

        {/* Tabela */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Data/Hora</TableHead>
                <TableHead className="w-[130px]">Tipo</TableHead>
                <TableHead>Rastreador</TableHead>
                <TableHead className="w-[60px] text-center">Qtd</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>NF / Fornecedor</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Skeleton loading
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : movimentacoesFiltradas.length === 0 ? (
                // Estado vazio
                <TableRow>
                  <TableCell colSpan={7} className="h-32">
                    <div className="flex flex-col items-center justify-center text-center">
                      <History className="h-10 w-10 text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">Nenhuma movimentação encontrada</p>
                      {temFiltrosAtivos && (
                        <Button variant="link" size="sm" onClick={limparFiltros}>
                          Limpar filtros
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                // Lista de movimentações
                movimentacoesFiltradas.map((mov) => {
                  const config = tipoConfig[mov.tipo] || tipoConfig.entrada;
                  const TipoIcon = config.icon;
                  
                  return (
                    <TableRow key={mov.id}>
                      {/* Data/Hora */}
                      <TableCell>
                        <div className="font-medium">
                          {format(new Date(mov.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(mov.created_at), "HH:mm")}
                        </div>
                      </TableCell>
                      
                      {/* Tipo */}
                      <TableCell>
                        <Badge className={`${config.bgColor} ${config.textColor} gap-1`}>
                          <TipoIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      
                      {/* Rastreador */}
                      <TableCell>
                        {mov.rastreador ? (
                          <div>
                            <div className="font-medium font-mono text-sm">
                              {mov.rastreador.codigo}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {mov.rastreador.plataforma}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      
                      {/* Quantidade */}
                      <TableCell className="text-center">
                        {mov.quantidade}
                      </TableCell>
                      
                      {/* Status */}
                      <TableCell>
                        {mov.status_anterior && mov.status_novo ? (
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-muted-foreground">{mov.status_anterior}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{mov.status_novo}</span>
                          </div>
                        ) : mov.status_novo ? (
                          <span className="font-medium text-sm">{mov.status_novo}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      
                      {/* NF / Fornecedor */}
                      <TableCell>
                        {mov.nota_fiscal || mov.fornecedor ? (
                          <div>
                            {mov.nota_fiscal && <p className="text-sm">{mov.nota_fiscal}</p>}
                            {mov.fornecedor && (
                              <p className="text-xs text-muted-foreground">
                                {mov.fornecedor}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      
                      {/* Responsável */}
                      <TableCell>
                        {mov.usuario?.nome || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
