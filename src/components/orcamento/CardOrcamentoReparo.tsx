import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Wrench, Plus, Pencil, X, CheckCircle, AlertTriangle, Lock, DollarSign, ClipboardList, Package, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  useOrcamentoReparo,
  useOrcamentoItens,
  useOrcamentoHistorico,
  useCriarOrcamento,
  useAdicionarItem,
  useEditarItem,
  useCancelarItem,
  useConsolidarOrcamento,
  useResetarOrcamento,
  type OrcamentoItem,
} from '@/hooks/useOrcamentoReparo';
import { AdicionarItemModal } from './AdicionarItemModal';
import { CancelarItemDialog } from './CancelarItemDialog';
import { ConsolidarOrcamentoModal } from './ConsolidarOrcamentoModal';
import { HistoricoAlteracoes } from './HistoricoAlteracoes';
import { EscolhaTipoOrcamentoModal } from './EscolhaTipoOrcamentoModal';
import { FormPacoteFechado } from './FormPacoteFechado';
import { CotacoesPecaModal } from './CotacoesPecaModal';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  elaboracao: { label: 'Em Elaboração', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  execucao: { label: 'Em Execução', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  consolidado: { label: 'Consolidado', className: 'bg-green-100 text-green-800 border-green-200' },
};

const ITEM_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-gray-100 text-gray-700' },
  aprovado: { label: 'Aprovado', className: 'bg-blue-100 text-blue-700' },
  comprado: { label: 'Comprado', className: 'bg-yellow-100 text-yellow-700' },
  instalado: { label: 'Instalado', className: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
};

const ORIGEM_BADGE: Record<string, { label: string; className: string }> = {
  original: { label: 'Original', className: 'bg-blue-100 text-blue-700' },
  seminova: { label: 'Seminova', className: 'bg-yellow-100 text-yellow-700' },
  paralela: { label: 'Paralela', className: 'bg-gray-100 text-gray-700' },
};

interface Props {
  sinistroId: string;
  valorFipe?: number;
  canEdit?: boolean;
  canChooseType?: boolean;
  canReset?: boolean;
  oficinaNome?: string;
}

export function CardOrcamentoReparo({ sinistroId, valorFipe, canEdit = false, canChooseType = false, canReset = false, oficinaNome }: Props) {
  const { data: orcamento, isLoading } = useOrcamentoReparo(sinistroId);
  const { data: itens = [] } = useOrcamentoItens(orcamento?.id);
  const { data: historico = [] } = useOrcamentoHistorico(orcamento?.id);

  const criarOrcamento = useCriarOrcamento();
  const adicionarItem = useAdicionarItem();
  const editarItem = useEditarItem();
  const cancelarItem = useCancelarItem();
  const consolidarOrcamento = useConsolidarOrcamento();
  const resetarOrcamento = useResetarOrcamento();

  const [showEscolha, setShowEscolha] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDefaultTipo, setAddDefaultTipo] = useState<'peca' | 'mao_de_obra'>('peca');
  const [editingItem, setEditingItem] = useState<OrcamentoItem | null>(null);
  const [cancellingItem, setCancellingItem] = useState<OrcamentoItem | null>(null);
  const [showConsolidar, setShowConsolidar] = useState(false);
  const [cotacoesItem, setCotacoesItem] = useState<OrcamentoItem | null>(null);
  const [resetMotivo, setResetMotivo] = useState('');

  const pecas = useMemo(() => itens.filter(i => i.tipo === 'peca'), [itens]);
  const mdo = useMemo(() => itens.filter(i => i.tipo === 'mao_de_obra'), [itens]);

  const canEditItems = canEdit && orcamento?.status !== 'consolidado';
  const variacao = orcamento ? orcamento.valor_total - orcamento.valor_inicial_total : 0;
  const variacaoPct = orcamento && orcamento.valor_inicial_total > 0 ? (variacao / orcamento.valor_inicial_total) * 100 : 0;
  const limiteFipe = valorFipe ? valorFipe * 0.75 : null;
  const alertaFipe = limiteFipe && orcamento ? orcamento.valor_total > limiteFipe : false;

  if (isLoading) return null;

  // Se não existe orçamento, mostrar botão/modal para criar
  if (!orcamento) {
    if (!canEdit && !canChooseType) return null;
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5" />
              Orçamento do Reparo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Nenhum orçamento criado para este evento.</p>
            <Button
              size="sm"
              onClick={() => setShowEscolha(true)}
              disabled={criarOrcamento.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Criar Orçamento
            </Button>
          </CardContent>
        </Card>
        <EscolhaTipoOrcamentoModal
          open={showEscolha}
          onClose={() => setShowEscolha(false)}
          onSelect={async (tipo) => {
            try {
              await criarOrcamento.mutateAsync({ sinistroId, tipoOrcamento: tipo });
              toast.success('Orçamento criado!');
              setShowEscolha(false);
            } catch (e: any) {
              toast.error('Erro: ' + e.message);
            }
          }}
          saving={criarOrcamento.isPending}
        />
      </>
    );
  }

  const statusBadge = STATUS_BADGE[orcamento.status] || STATUS_BADGE.elaboracao;
  const isPacoteFechado = orcamento.tipo_orcamento === 'pacote_fechado';

  const handleAddItem = async (item: Partial<OrcamentoItem>, motivo: string) => {
    try {
      await adicionarItem.mutateAsync({ orcamentoId: orcamento.id, item, motivo });
      toast.success('Item adicionado!');
      setShowAddModal(false);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleEditItem = async (item: Partial<OrcamentoItem>, motivo: string) => {
    if (!editingItem) return;
    try {
      await editarItem.mutateAsync({ item: editingItem, changes: item, motivo });
      toast.success('Item atualizado!');
      setEditingItem(null);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleCancelarItem = async (motivo: string) => {
    if (!cancellingItem) return;
    try {
      await cancelarItem.mutateAsync({ item: cancellingItem, motivo });
      toast.success('Item cancelado!');
      setCancellingItem(null);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleConsolidar = async (obs: string) => {
    try {
      await consolidarOrcamento.mutateAsync({ orcamentoId: orcamento.id, observacaoFinal: obs });
      toast.success('Orçamento consolidado com sucesso!');
      setShowConsolidar(false);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleReset = async () => {
    if (!resetMotivo.trim()) { toast.error('Informe o motivo'); return; }
    try {
      await resetarOrcamento.mutateAsync({ orcamentoId: orcamento.id, sinistroId, motivo: resetMotivo });
      toast.success('Orçamento resetado!');
      setResetMotivo('');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const renderItemRow = (item: OrcamentoItem, showOrigem: boolean) => {
    const isCancelado = item.status === 'cancelado';
    const itemStatus = ITEM_STATUS_BADGE[item.status] || ITEM_STATUS_BADGE.pendente;
    return (
      <TableRow key={item.id} className={isCancelado ? 'opacity-60 bg-muted/30' : ''}>
        <TableCell className={isCancelado ? 'line-through' : ''}>{item.descricao}</TableCell>
        {showOrigem && (
          <TableCell>
            {item.origem && (
              <Badge variant="outline" className={`text-[10px] ${ORIGEM_BADGE[item.origem]?.className || ''}`}>
                {ORIGEM_BADGE[item.origem]?.label || item.origem}
              </Badge>
            )}
          </TableCell>
        )}
        <TableCell className="text-right">{item.quantidade}</TableCell>
        <TableCell className="text-right">R$ {item.valor_unitario?.toFixed(2)}</TableCell>
        <TableCell className="text-right font-medium">R$ {item.valor_total?.toFixed(2)}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-[10px] ${itemStatus.className}`}>{itemStatus.label}</Badge>
        </TableCell>
        {/* Coluna Cotações (só peças no caminho cotação separada) */}
        {showOrigem && (
          <TableCell>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setCotacoesItem(item)}>
              📊 Cotações
            </Button>
          </TableCell>
        )}
        <TableCell>
          {canEditItems && !isCancelado && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(item)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCancellingItem(item)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5" />
              Orçamento do Reparo
              <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
              {isPacoteFechado ? (
                <Badge variant="secondary" className="gap-1 text-xs"><Package className="h-3 w-3" /> Pacote Fechado</Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-xs"><ClipboardList className="h-3 w-3" /> Cotação Separada</Badge>
              )}
              {orcamento.status === 'consolidado' && <Lock className="h-4 w-4 text-muted-foreground" />}
            </CardTitle>
            <div className="flex items-center gap-2">
              {oficinaNome && <span className="text-xs text-muted-foreground">{oficinaNome}</span>}
              {canReset && orcamento.status !== 'consolidado' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1">
                      <RotateCcw className="h-3 w-3" /> Resetar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resetar Orçamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso apagará o orçamento e todos os seus itens, cotações e histórico. O analista poderá escolher novamente o tipo de orçamento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div>
                      <Label>Motivo *</Label>
                      <Textarea value={resetMotivo} onChange={(e) => setResetMotivo(e.target.value)} placeholder="Por que está resetando o orçamento?" rows={2} />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setResetMotivo('')}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset} disabled={!resetMotivo.trim() || resetarOrcamento.isPending}>
                        {resetarOrcamento.isPending ? 'Resetando...' : 'Confirmar Reset'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPacoteFechado ? (
            /* ====== PACOTE FECHADO ====== */
            <>
              <FormPacoteFechado
                orcamento={orcamento}
                valorFipe={valorFipe}
                canEdit={canEdit && orcamento.status !== 'consolidado'}
                oficinaNome={oficinaNome}
              />

              {/* Consolidar para pacote fechado */}
              {canEdit && orcamento.status !== 'consolidado' && orcamento.valor_pacote && (
                <Button size="sm" onClick={() => setShowConsolidar(true)}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Consolidar Orçamento
                </Button>
              )}

              {/* Histórico */}
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Histórico de Alterações ({historico.length})</p>
                <HistoricoAlteracoes historico={historico} />
              </div>
            </>
          ) : (
            /* ====== COTAÇÃO SEPARADA ====== */
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Peças</p>
                  <p className="text-lg font-bold">R$ {orcamento.valor_pecas?.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Mão de Obra</p>
                  <p className="text-lg font-bold">R$ {orcamento.valor_mao_obra?.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center bg-primary/5">
                  <p className="text-xs text-muted-foreground">Total Geral</p>
                  <p className="text-lg font-bold text-primary">R$ {orcamento.valor_total?.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Variação</p>
                  {orcamento.valor_inicial_total > 0 ? (
                    <p className={`text-lg font-bold ${variacao > 0 ? 'text-destructive' : variacao < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {variacao > 0 ? '+' : ''}R$ {variacao.toFixed(2)}
                      <span className="text-xs block">({variacaoPct > 0 ? '+' : ''}{variacaoPct.toFixed(1)}%)</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>

              {/* FIPE info */}
              {valorFipe && valorFipe > 0 && (
                <div className={`text-xs p-2 rounded ${alertaFipe ? 'bg-destructive/10 border border-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                  {alertaFipe && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                  Valor FIPE: R$ {valorFipe.toFixed(0)} — Limite 75%: R$ {limiteFipe?.toFixed(0)}
                  {alertaFipe && ' — ⚠️ ATENÇÃO: Custo ultrapassou 75% da FIPE — pode configurar Perda Total'}
                </div>
              )}

              {/* Action buttons */}
              {canEditItems && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { setAddDefaultTipo('peca'); setShowAddModal(true); }}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Peça
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddDefaultTipo('mao_de_obra'); setShowAddModal(true); }}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Serviço
                  </Button>
                  {canEdit && orcamento.status !== 'consolidado' && itens.length > 0 && (
                    <Button size="sm" onClick={() => setShowConsolidar(true)}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Consolidar Orçamento
                    </Button>
                  )}
                </div>
              )}

              {/* Tabs */}
              <Tabs defaultValue="pecas">
                <TabsList>
                  <TabsTrigger value="pecas">🔧 Peças ({pecas.length})</TabsTrigger>
                  <TabsTrigger value="mdo">🛠️ Mão de Obra ({mdo.length})</TabsTrigger>
                  <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pecas">
                  {pecas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma peça adicionada.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Cotações</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pecas.map(i => renderItemRow(i, true))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={4} className="text-right">Subtotal Peças:</TableCell>
                          <TableCell className="text-right">
                            R$ {pecas.filter(p => p.status !== 'cancelado').reduce((s, p) => s + (p.valor_total || 0), 0).toFixed(2)}
                          </TableCell>
                          <TableCell colSpan={3} />
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="mdo">
                  {mdo.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço adicionado.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mdo.map(i => renderItemRow(i, false))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={3} className="text-right">Subtotal Mão de Obra:</TableCell>
                          <TableCell className="text-right">
                            R$ {mdo.filter(m => m.status !== 'cancelado').reduce((s, m) => s + (m.valor_total || 0), 0).toFixed(2)}
                          </TableCell>
                          <TableCell colSpan={2} />
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="historico">
                  <HistoricoAlteracoes historico={historico} />
                </TabsContent>
              </Tabs>

              {/* Footer totals */}
              {itens.length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-end gap-6 text-sm">
                    <span className="text-muted-foreground">Peças: <strong>R$ {orcamento.valor_pecas?.toFixed(2)}</strong></span>
                    <span className="text-muted-foreground">M.O.: <strong>R$ {orcamento.valor_mao_obra?.toFixed(2)}</strong></span>
                    <span className="font-bold text-base">TOTAL: R$ {orcamento.valor_total?.toFixed(2)}</span>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AdicionarItemModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddItem}
        defaultTipo={addDefaultTipo}
        orcamentoEmExecucao={orcamento.status === 'execucao'}
        saving={adicionarItem.isPending}
      />

      <AdicionarItemModal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleEditItem}
        editItem={editingItem}
        orcamentoEmExecucao={orcamento.status === 'execucao'}
        saving={editarItem.isPending}
      />

      {cancellingItem && (
        <CancelarItemDialog
          open={!!cancellingItem}
          onClose={() => setCancellingItem(null)}
          onConfirm={handleCancelarItem}
          itemDescricao={cancellingItem.descricao}
          saving={cancelarItem.isPending}
        />
      )}

      {showConsolidar && (
        <ConsolidarOrcamentoModal
          open={showConsolidar}
          onClose={() => setShowConsolidar(false)}
          onConfirm={handleConsolidar}
          orcamento={orcamento}
          itens={itens}
          valorFipe={valorFipe}
          saving={consolidarOrcamento.isPending}
        />
      )}

      {cotacoesItem && (
        <CotacoesPecaModal
          open={!!cotacoesItem}
          onClose={() => setCotacoesItem(null)}
          itemId={cotacoesItem.id}
          itemDescricao={cotacoesItem.descricao}
          canEdit={canEditItems}
        />
      )}
    </>
  );
}
