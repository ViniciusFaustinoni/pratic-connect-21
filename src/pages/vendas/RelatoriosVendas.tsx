import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Filter, Users, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useVendedores } from "@/hooks/useVendedores";
import { ORIGEM_LABELS, ETAPA_LABELS, ETAPA_CORES } from "@/hooks/useVendasMetricas";

export default function RelatoriosVendas() {
  const [dataInicio, setDataInicio] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [dataFim, setDataFim] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [vendedor, setVendedor] = useState("todos");
  const [origem, setOrigem] = useState("todos");
  const [etapa, setEtapa] = useState("todos");

  const { data: vendedores } = useVendedores();

  // Buscar dados do relatório
  const { data: dados, isLoading } = useQuery({
    queryKey: ["relatorio-vendas", dataInicio, dataFim, vendedor, origem, etapa],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*")
        .gte("created_at", `${dataInicio}T00:00:00`)
        .lte("created_at", `${dataFim}T23:59:59`)
        .order("created_at", { ascending: false });

      if (vendedor !== "todos") {
        query = query.eq("vendedor_id", vendedor);
      }
      if (origem !== "todos") {
        query = query.eq("origem", origem as any);
      }
      if (etapa !== "todos") {
        query = query.eq("etapa", etapa as any);
      }

      const { data: leads, error } = await query;
      if (error) throw error;

      // Buscar vendedores separadamente
      const vendedorIds = [...new Set((leads || []).filter(l => l.vendedor_id).map(l => l.vendedor_id))];
      
      let vendedoresMap: Record<string, string> = {};
      if (vendedorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", vendedorIds as string[]);
        
        vendedoresMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.nome;
          return acc;
        }, {} as Record<string, string>);
      }

      return (leads || []).map(lead => ({
        ...lead,
        vendedor_nome: lead.vendedor_id ? vendedoresMap[lead.vendedor_id] || null : null,
      }));
    },
  });

  // Calcular resumo
  const resumo = {
    totalLeads: dados?.length || 0,
    ganhos: dados?.filter((l) => l.etapa === "ganho").length || 0,
    perdidos: dados?.filter((l) => l.etapa === "perdido").length || 0,
  };

  const exportarExcel = () => {
    if (!dados?.length) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const dadosExcel = dados.map((item) => ({
      Data: format(new Date(item.created_at), "dd/MM/yyyy HH:mm"),
      Nome: item.nome,
      Telefone: item.telefone,
      Email: item.email || "",
      CPF: item.cpf || "",
      Vendedor: item.vendedor_nome || "",
      Origem: ORIGEM_LABELS[item.origem] || item.origem,
      Etapa: ETAPA_LABELS[item.etapa] || item.etapa,
      "Veículo Marca": item.veiculo_marca || "",
      "Veículo Modelo": item.veiculo_modelo || "",
      "Veículo Ano": item.veiculo_ano || "",
      "Veículo Placa": item.veiculo_placa || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `relatorio-vendas-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Relatório exportado!");
  };

  const getEtapaBadgeVariant = (etapa: string) => {
    if (etapa === "ganho") return "default";
    if (etapa === "perdido") return "destructive";
    return "secondary";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Vendas</h1>
          <p className="text-muted-foreground">
            Exporte dados de leads e vendas
          </p>
        </div>

        <Button onClick={exportarExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={vendedor} onValueChange={setVendedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {vendedores?.map((v) => (
                    <SelectItem key={v.id} value={v.user_id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={etapa} onValueChange={setEtapa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(ETAPA_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resumo.totalLeads}</p>
              <p className="text-sm text-muted-foreground">Total de Leads</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resumo.ganhos}</p>
              <p className="text-sm text-muted-foreground">Ganhos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resumo.perdidos}</p>
              <p className="text-sm text-muted-foreground">Perdidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
          <CardDescription>
            {dados?.length || 0} registros encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Etapa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : dados?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  dados?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(item.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{item.telefone}</TableCell>
                      <TableCell>{item.vendedor_nome || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ORIGEM_LABELS[item.origem] || item.origem}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getEtapaBadgeVariant(item.etapa)}
                          style={{ 
                            backgroundColor: item.etapa !== "ganho" && item.etapa !== "perdido" 
                              ? ETAPA_CORES[item.etapa] + "20" 
                              : undefined,
                            color: item.etapa !== "ganho" && item.etapa !== "perdido" 
                              ? ETAPA_CORES[item.etapa] 
                              : undefined,
                          }}
                        >
                          {ETAPA_LABELS[item.etapa] || item.etapa}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
