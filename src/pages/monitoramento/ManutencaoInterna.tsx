import { useState } from 'react';
import { 
  Wrench, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2,
  ArrowRight,
  FileText,
  Trash2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PermissionGate } from '@/components/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useManutencaoInternaLista,
  useManutencaoInternaMetricas,
  useIniciarTriagem,
  type EtapaManutencaoInterna,
  type ManutencaoInterna,
  ETAPA_MANUTENCAO_INTERNA_LABELS,
  ETAPA_MANUTENCAO_INTERNA_COLORS,
} from '@/hooks/useManutencaoInterna';
import {
  TriagemModal,
  EncaminharPlataformaModal,
  EncaminharGarantiaModal,
  RegistrarLaudoModal,
  ConfirmarDescarteModal,
} from '@/components/monitoramento/manutencao-interna';

export default function ManutencaoInterna() {
  const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
  const temAcesso = isDiretor || isCoordenadorMonitoramento;
  const podeDescartar = isDiretor; // SOMENTE diretor pode descartar

  const [busca, setBusca] = useState('');
  const [etapaFiltro, setEtapaFiltro] = useState<EtapaManutencaoInterna | 'todas'>('todas');
  
  // Modais
  const [modalTriagem, setModalTriagem] = useState(false);
  const [modalPlataforma, setModalPlataforma] = useState(false);
  const [modalGarantia, setModalGarantia] = useState(false);
  const [modalLaudo, setModalLaudo] = useState(false);
  const [modalDescarte, setModalDescarte] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<ManutencaoInterna | null>(null);

  const { data: manutencoes, isLoading } = useManutencaoInternaLista(
    etapaFiltro !== 'todas' ? etapaFiltro : undefined
  );
  const { data: metricas, isLoading: loadingMetricas } = useManutencaoInternaMetricas();
  const iniciarTriagemMutation = useIniciarTriagem();

  // Tela de acesso restrito
  if (!temAcesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">Acesso Restrito</h2>
            <p className="text-muted-foreground mt-2">
              Apenas Diretores e Coordenadores de Monitoramento podem acessar a Manutenção Interna.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filtrar por busca
  const manutencoesFiltered = manutencoes?.filter((m) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      m.rastreador?.codigo?.toLowerCase().includes(termo) ||
      m.rastreador?.imei?.toLowerCase().includes(termo) ||
      m.servico_origem?.protocolo?.toLowerCase().includes(termo)
    );
  });

  const handleIniciarTriagem = async (item: ManutencaoInterna) => {
    await iniciarTriagemMutation.mutateAsync({ manutencaoId: item.id });
  };

  const handleAbrirModal = (item: ManutencaoInterna, modal: 'triagem' | 'plataforma' | 'garantia' | 'laudo' | 'descarte') => {
    setItemSelecionado(item);
    switch (modal) {
      case 'triagem':
        setModalTriagem(true);
        break;
      case 'plataforma':
        setModalPlataforma(true);
        break;
      case 'garantia':
        setModalGarantia(true);
        break;
      case 'laudo':
        setModalLaudo(true);
        break;
      case 'descarte':
        setModalDescarte(true);
        break;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              Manutenção Interna (Bancada)
            </h1>
            <p className="text-muted-foreground">
              Rastreadores retornados do campo aguardando triagem ou análise
            </p>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aguardando Triagem</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {loadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{metricas?.aguardandoTriagem || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Triagem</CardTitle>
              <Search className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              {loadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{metricas?.emTriagem || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Análise Plataforma</CardTitle>
              <ArrowRight className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              {loadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{metricas?.analisePlataforma || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Garantia</CardTitle>
              <FileText className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{metricas?.emGarantia || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, IMEI ou protocolo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={etapaFiltro}
                onValueChange={(v) => setEtapaFiltro(v as EtapaManutencaoInterna | 'todas')}
              >
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Etapas</SelectItem>
                  <SelectItem value="aguardando_triagem">Aguardando Triagem</SelectItem>
                  <SelectItem value="em_triagem">Em Triagem</SelectItem>
                  <SelectItem value="em_analise_plataforma">Análise Plataforma</SelectItem>
                  <SelectItem value="em_garantia">Em Garantia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Rastreadores em Manutenção</CardTitle>
            <CardDescription>
              {manutencoesFiltered?.length || 0} rastreador(es) na fila
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : manutencoesFiltered?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum rastreador na fila de manutenção interna</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rastreador</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Encaminhado Para</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manutencoesFiltered?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <span className="font-mono font-medium">{item.rastreador?.codigo}</span>
                          <p className="text-xs text-muted-foreground">{item.rastreador?.imei}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.servico_origem?.protocolo ? (
                          <span className="text-sm">{item.servico_origem.protocolo}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={ETAPA_MANUTENCAO_INTERNA_COLORS[item.etapa]}>
                          {ETAPA_MANUTENCAO_INTERNA_LABELS[item.etapa]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(item.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.encaminhado_para ? (
                          <div>
                            <span className="text-sm">{item.encaminhado_para}</span>
                            {item.numero_protocolo_externo && (
                              <p className="text-xs text-muted-foreground">
                                #{item.numero_protocolo_externo}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Ações
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.etapa === 'aguardando_triagem' && (
                              <DropdownMenuItem onClick={() => handleIniciarTriagem(item)}>
                                <Search className="h-4 w-4 mr-2" />
                                Iniciar Triagem
                              </DropdownMenuItem>
                            )}

                            {item.etapa === 'em_triagem' && (
                              <>
                                <DropdownMenuItem onClick={() => handleAbrirModal(item, 'triagem')}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Resolver Internamente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAbrirModal(item, 'plataforma')}>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Encaminhar Plataforma
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAbrirModal(item, 'garantia')}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Encaminhar Garantia
                                </DropdownMenuItem>
                                {podeDescartar && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleAbrirModal(item, 'descarte')}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Descartar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}

                            {(item.etapa === 'em_analise_plataforma' || item.etapa === 'em_garantia') && (
                              <DropdownMenuItem onClick={() => handleAbrirModal(item, 'laudo')}>
                                <FileText className="h-4 w-4 mr-2" />
                                Registrar Laudo
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Modais */}
        <TriagemModal 
          open={modalTriagem} 
          onOpenChange={setModalTriagem}
          manutencao={itemSelecionado}
        />
        <EncaminharPlataformaModal 
          open={modalPlataforma} 
          onOpenChange={setModalPlataforma}
          manutencao={itemSelecionado}
        />
        <EncaminharGarantiaModal 
          open={modalGarantia} 
          onOpenChange={setModalGarantia}
          manutencao={itemSelecionado}
        />
        <RegistrarLaudoModal 
          open={modalLaudo} 
          onOpenChange={setModalLaudo}
          manutencao={itemSelecionado}
        />
        <ConfirmarDescarteModal 
          open={modalDescarte} 
          onOpenChange={setModalDescarte}
          manutencao={itemSelecionado}
        />
      </div>
    </div>
  );
}
