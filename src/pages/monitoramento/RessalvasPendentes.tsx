import { useState } from 'react';
import { 
  AlertTriangle, Search, Clock, User, Car, Wrench, 
  CheckCircle2, XCircle, Loader2, Eye, Image, ShieldAlert 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useRessalvasPendentesMonitoramento, 
  useContagemRessalvasMonitoramento,
  useDecidirRessalva,
  type RessalvaMonitoramento 
} from '@/hooks/useRessalvasMonitoramento';

export default function RessalvasPendentes() {
  const { data: ressalvas, isLoading } = useRessalvasPendentesMonitoramento();
  const { data: totalPendentes } = useContagemRessalvasMonitoramento();
  const decidirMutation = useDecidirRessalva();
  
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<RessalvaMonitoramento | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [confirmandoDecisao, setConfirmandoDecisao] = useState<'aprovar' | 'declinar' | null>(null);

  const filtradas = (ressalvas || []).filter(r => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      r.associado_nome?.toLowerCase().includes(termo) ||
      r.veiculo_placa?.toLowerCase().includes(termo) ||
      r.veiculo_modelo?.toLowerCase().includes(termo) ||
      r.instalador_nome?.toLowerCase().includes(termo)
    );
  });

  const handleDecidir = async (decisao: 'aprovar' | 'declinar') => {
    if (!selecionada) return;
    await decidirMutation.mutateAsync({
      servicoId: selecionada.id,
      veiculoId: selecionada.veiculo_id,
      associadoId: selecionada.associado_id,
      placa: selecionada.veiculo_placa || '',
      decisao,
      justificativa: justificativa.trim() || undefined,
    });
    setSelecionada(null);
    setJustificativa('');
    setConfirmandoDecisao(null);
  };

  // Parse checklist items NOK
  const getItensNok = (checklistData: Record<string, unknown> | null) => {
    if (!checklistData) return [];
    return Object.entries(checklistData)
      .filter(([, val]: [string, any]) => val?.status === 'nok')
      .map(([key, val]: [string, any]) => ({
        id: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        observacao: val?.observacao || null,
        fotos: val?.fotos || [],
      }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ressalvas Pendentes</h1>
          <p className="text-muted-foreground">
            Solicitações do instalador aguardando confirmação do monitoramento
          </p>
        </div>
        {totalPendentes !== undefined && totalPendentes > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1 self-start">
            {totalPendentes} pendente{totalPendentes > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por associado, placa, modelo ou instalador..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">Nenhuma ressalva pendente</p>
            <p className="text-muted-foreground text-sm mt-1">
              Todas as solicitações foram processadas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtradas.map(ressalva => (
            <Card 
              key={ressalva.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelecionada(ressalva)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Pendente Monitoramento
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{ressalva.associado_nome || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {ressalva.veiculo_placa} - {ressalva.veiculo_marca} {ressalva.veiculo_modelo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{ressalva.instalador_nome || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(ressalva.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Eye className="h-4 w-4 mr-1" />
                    Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={!!selecionada && !confirmandoDecisao} onOpenChange={(open) => { if (!open) setSelecionada(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Detalhes da Ressalva
            </DialogTitle>
            <DialogDescription>
              Analise os itens reprovados e decida se aprova ou declina.
            </DialogDescription>
          </DialogHeader>

          {selecionada && (
            <div className="space-y-4">
              {/* Info do associado/veículo */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Associado</p>
                  <p className="font-medium">{selecionada.associado_nome}</p>
                  {selecionada.associado_cpf && (
                    <p className="text-xs text-muted-foreground">{selecionada.associado_cpf}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Veículo</p>
                  <p className="font-medium">{selecionada.veiculo_placa}</p>
                  <p className="text-xs text-muted-foreground">
                    {selecionada.veiculo_marca} {selecionada.veiculo_modelo}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Instalador</p>
                  <p className="font-medium">{selecionada.instalador_nome || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p className="font-medium">
                    {format(new Date(selecionada.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Ressalvas texto */}
              {selecionada.ressalvas_instalador && (
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase mb-1">Observações do Instalador</p>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-sm whitespace-pre-line">{selecionada.ressalvas_instalador}</p>
                  </div>
                </div>
              )}

              {/* Itens NOK do checklist */}
              {selecionada.checklist_data && (
                <div>
                  <p className="text-xs font-semibold text-red-600 uppercase mb-1">Itens Reprovados (NOK)</p>
                  <div className="space-y-2">
                    {getItensNok(selecionada.checklist_data).map(item => (
                      <div key={item.id} className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.observacao && (
                            <p className="text-xs text-muted-foreground">{item.observacao}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {getItensNok(selecionada.checklist_data).length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum item NOK encontrado no checklist.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Fotos de evidência */}
              {selecionada.fotos_ressalva && selecionada.fotos_ressalva.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase mb-2 flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Fotos de Evidência ({selecionada.fotos_ressalva.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {selecionada.fotos_ressalva.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={url} 
                          alt={`Evidência ${i + 1}`} 
                          className="w-full aspect-square object-cover rounded-lg border hover:opacity-80 transition-opacity" 
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col mt-4">
            <Button
              onClick={() => setConfirmandoDecisao('aprovar')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Aprovar (seguir com ressalva)
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmandoDecisao('declinar')}
              className="w-full"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Declinar (blacklist)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação da Decisão */}
      <Dialog open={!!confirmandoDecisao} onOpenChange={(open) => { if (!open) { setConfirmandoDecisao(null); setJustificativa(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmandoDecisao === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Recusa'}
            </DialogTitle>
            <DialogDescription>
              {confirmandoDecisao === 'aprovar'
                ? 'A solicitação seguirá para análise de cadastro.'
                : 'O veículo será incluído na blacklist e o associado será cancelado.'
              }
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Justificativa (opcional)..."
            value={justificativa}
            onChange={e => setJustificativa(e.target.value)}
            className="min-h-[80px]"
          />

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => { setConfirmandoDecisao(null); setJustificativa(''); }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleDecidir(confirmandoDecisao!)}
              disabled={decidirMutation.isPending}
              className={`w-full sm:w-auto ${confirmandoDecisao === 'aprovar' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              variant={confirmandoDecisao === 'declinar' ? 'destructive' : 'default'}
            >
              {decidirMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {confirmandoDecisao === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
