import { useState } from 'react';
import { useBaseAntigaAssociados, useBaseAntigaDetalhe, useBaseAntigaVeiculos } from '@/hooks/useBaseAntiga';
import { useDeleteBaseAntiga } from '@/hooks/useDeleteBaseAntiga';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Database, ChevronLeft, ChevronRight, User, Car, Radio, Receipt, Trash2, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { VeiculoDetalhesModal } from '@/components/cadastro/VeiculoDetalhesModal';

const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-green-100 text-green-800',
  inadimplente: 'bg-orange-100 text-orange-800',
  suspenso: 'bg-yellow-100 text-yellow-800',
  cancelado: 'bg-red-100 text-red-800',
  em_analise: 'bg-blue-100 text-blue-800',
  bloqueado: 'bg-gray-100 text-gray-800',
};

export default function BaseAntiga() {
  const [mainTab, setMainTab] = useState('associados');

  // Associados state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>();

  // Veiculos state
  const [vSearch, setVSearch] = useState('');
  const [vDebouncedSearch, setVDebouncedSearch] = useState('');
  const [vPage, setVPage] = useState(1);
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string | null>(null);
  const [vTimer, setVTimer] = useState<ReturnType<typeof setTimeout>>();
  const [semRastreador, setSemRastreador] = useState(false);

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(timer);
    const t = setTimeout(() => { setDebouncedSearch(value); setPage(1); }, 400);
    setTimer(t);
  };

  const handleVSearch = (value: string) => {
    setVSearch(value);
    clearTimeout(vTimer);
    const t = setTimeout(() => { setVDebouncedSearch(value); setVPage(1); }, 400);
    setVTimer(t);
  };

  const { data, isLoading } = useBaseAntigaAssociados({ search: debouncedSearch }, { page, pageSize: 20 });
  const { data: detalhe, isLoading: loadingDetalhe } = useBaseAntigaDetalhe(selectedId ?? undefined);
  const { data: vData, isLoading: vLoading } = useBaseAntigaVeiculos({ search: vDebouncedSearch, semRastreador }, { page: vPage, pageSize: 20 });
  const { isDiretor, isAdminMaster, isDesenvolvedor } = usePermissions();
  const canDelete = isDiretor || isAdminMaster || isDesenvolvedor;
  const deleteAssociado = useDeleteBaseAntiga('associado');
  const deleteVeiculo = useDeleteBaseAntiga('veiculo');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string; tipo: 'associado' | 'veiculo' } | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string, nome: string, tipo: 'associado' | 'veiculo') => {
    e.stopPropagation();
    setDeleteConfirm({ id, nome, tipo });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const mutation = deleteConfirm.tipo === 'associado' ? deleteAssociado : deleteVeiculo;
    mutation.mutate(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const formatCpf = (cpf: string) => {
    if (!cpf || cpf.length !== 11) return cpf;
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  };
  const formatDate = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('pt-BR');
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-muted-foreground" />
            Base Antiga (SGA)
          </h1>
          <p className="text-sm text-muted-foreground">Associados e Veículos importados do sistema SGA/Hinova</p>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="associados" className="gap-1.5">
            <User className="h-4 w-4" /> Associados
            {data && <Badge variant="secondary" className="ml-1 text-xs">{data.pagination.total}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="gap-1.5">
            <Car className="h-4 w-4" /> Veículos
            {vData && <Badge variant="secondary" className="ml-1 text-xs">{vData.pagination.total}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ====== ABA ASSOCIADOS ====== */}
        <TabsContent value="associados" className="space-y-4 mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF, placa ou chassi..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-10" />
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Plano</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Cód. Hinova</TableHead>
                     {canDelete && <TableHead className="w-12"></TableHead>}
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                       <TableRow key={i}>{Array.from({ length: canDelete ? 8 : 7 }).map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>))}</TableRow>
                     ))
                   ) : !data?.associados.length ? (
                     <TableRow><TableCell colSpan={canDelete ? 8 : 7} className="text-center py-8 text-muted-foreground">Nenhum associado encontrado</TableCell></TableRow>
                  ) : (
                    data.associados.map((a: any) => (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(a.id)}>
                        <TableCell className="font-medium">
                          {a.nome}
                          <Badge variant="outline" className="ml-2 text-xs bg-violet-50 text-violet-700 border-violet-200">SGA</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{formatCpf(a.cpf)}</TableCell>
                        <TableCell>{a.telefone || '—'}</TableCell>
                        <TableCell>{a.cidade ? `${a.cidade}/${a.uf}` : '—'}</TableCell>
                        <TableCell>{(a as any).planos?.nome || '—'}</TableCell>
                        <TableCell><Badge className={STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-800'}>{a.status?.replace(/_/g, ' ')}</Badge></TableCell>
                         <TableCell className="font-mono">{a.codigo_hinova || '—'}</TableCell>
                         {canDelete && (
                           <TableCell>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, a.id, a.nome, 'associado')}>
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </TableCell>
                         )}
                       </TableRow>
                     ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
              ))
            ) : !data?.associados.length ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Nenhum associado encontrado</CardContent></Card>
            ) : (
              data.associados.map((a: any) => (
                <Card key={a.id} className="cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setSelectedId(a.id)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{a.nome}</p>
                        <p className="font-mono text-xs text-muted-foreground">{formatCpf(a.cpf)}</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 shrink-0">SGA</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className={`${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-800'} text-xs`}>{a.status?.replace(/_/g, ' ')}</Badge>
                      {(a as any).planos?.nome && <Badge variant="secondary" className="text-xs">{(a as any).planos.nome}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {a.telefone && <p>📞 {a.telefone}</p>}
                      {a.cidade && <p>📍 {a.cidade}/{a.uf}</p>}
                      {a.codigo_hinova && <p className="font-mono">Hinova: {a.codigo_hinova}</p>}
                    </div>
                    {canDelete && (
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, a.id, a.nome, 'associado')}>
                          <Trash2 className="h-4 w-4 mr-1" /> Excluir
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Página {data.pagination.page} de {data.pagination.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Próximo <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ====== ABA VEÍCULOS ====== */}
        <TabsContent value="veiculos" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por placa, chassi, marca ou modelo..." value={vSearch} onChange={e => handleVSearch(e.target.value)} className="pl-10" />
            </div>
            <Button
              variant={semRastreador ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 whitespace-nowrap"
              onClick={() => { setSemRastreador(prev => !prev); setVPage(1); }}
            >
              <WifiOff className="h-4 w-4" />
              Sem Rastreador
            </Button>
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Associado</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Rastreador</TableHead>
                     {canDelete && <TableHead className="w-12"></TableHead>}
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {vLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                       <TableRow key={i}>{Array.from({ length: canDelete ? 8 : 7 }).map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>))}</TableRow>
                     ))
                   ) : !vData?.veiculos.length ? (
                     <TableRow><TableCell colSpan={canDelete ? 8 : 7} className="text-center py-8 text-muted-foreground">Nenhum veículo encontrado</TableCell></TableRow>
                  ) : (
                    vData.veiculos.map((v: any) => (
                      <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedVeiculoId(v.id)}>
                        <TableCell className="font-mono font-bold">{v.placa || '—'}</TableCell>
                        <TableCell>{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</TableCell>
                        <TableCell>{v.ano_fabricacao && v.ano_modelo ? `${v.ano_fabricacao}/${v.ano_modelo}` : v.ano_modelo || '—'}</TableCell>
                        <TableCell>{v.cor || '—'}</TableCell>
                        <TableCell>
                          <span className="text-sm">{v.associado?.nome || '—'}</span>
                        </TableCell>
                        <TableCell><Badge className={STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-800'}>{v.status?.replace(/_/g, ' ') || '—'}</Badge></TableCell>
                        <TableCell>
                          {v.rastreador ? (
                            <div className="flex items-center gap-1">
                              <Radio className={`h-3.5 w-3.5 ${v.rastreador.status === 'ativo' ? 'text-green-600' : 'text-gray-400'}`} />
                              <span className="text-xs">{v.rastreador.codigo}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                         )}
                         </TableCell>
                         {canDelete && (
                           <TableCell>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, v.id, v.placa || 'Veículo', 'veiculo')}>
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </TableCell>
                         )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {vLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
              ))
            ) : !vData?.veiculos.length ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Nenhum veículo encontrado</CardContent></Card>
            ) : (
              vData.veiculos.map((v: any) => (
                <Card key={v.id} className="cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setSelectedVeiculoId(v.id)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-bold text-base">{v.placa || '—'}</p>
                        <p className="text-sm truncate">{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</p>
                      </div>
                      <Badge className={`${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-800'} text-xs shrink-0`}>{v.status?.replace(/_/g, ' ') || '—'}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {(v.ano_fabricacao || v.ano_modelo) && <p>Ano: {v.ano_fabricacao && v.ano_modelo ? `${v.ano_fabricacao}/${v.ano_modelo}` : v.ano_modelo}</p>}
                      {v.cor && <p>Cor: {v.cor}</p>}
                      {v.associado?.nome && <p className="truncate">👤 {v.associado.nome}</p>}
                      {v.rastreador && (
                        <p className="flex items-center gap-1">
                          <Radio className={`h-3 w-3 ${v.rastreador.status === 'ativo' ? 'text-green-600' : 'text-gray-400'}`} />
                          {v.rastreador.codigo}
                        </p>
                      )}
                    </div>
                    {canDelete && (
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, v.id, v.placa || 'Veículo', 'veiculo')}>
                          <Trash2 className="h-4 w-4 mr-1" /> Excluir
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {vData && vData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Página {vData.pagination.page} de {vData.pagination.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={vPage <= 1} onClick={() => setVPage(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</Button>
                <Button variant="outline" size="sm" disabled={vPage >= vData.pagination.totalPages} onClick={() => setVPage(p => p + 1)}>Próximo <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Modal - Associado */}
      <Dialog open={!!selectedId} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {loadingDetalhe ? (
            <div className="space-y-4 p-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full" /></div>
          ) : detalhe ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detalhe.associado.nome}
                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">SGA</Badge>
                  <Badge className={STATUS_COLORS[detalhe.associado.status] || ''}>{detalhe.associado.status?.replace(/_/g, ' ')}</Badge>
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="dados" className="mt-2">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="dados" className="gap-1"><User className="h-3.5 w-3.5" /> Dados</TabsTrigger>
                  <TabsTrigger value="veiculos" className="gap-1"><Car className="h-3.5 w-3.5" /> Veículos ({detalhe.veiculos.length})</TabsTrigger>
                  <TabsTrigger value="boletos" className="gap-1"><Receipt className="h-3.5 w-3.5" /> Boletos ({detalhe.cobrancas.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="dados" className="mt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <Info label="CPF" value={formatCpf(detalhe.associado.cpf)} />
                    <Info label="Telefone" value={detalhe.associado.telefone} />
                    <Info label="Email" value={detalhe.associado.email} />
                    <Info label="WhatsApp" value={detalhe.associado.whatsapp} />
                    <Info label="Endereço" value={[detalhe.associado.logradouro, detalhe.associado.numero, detalhe.associado.bairro].filter(Boolean).join(', ')} />
                    <Info label="Cidade/UF" value={detalhe.associado.cidade ? `${detalhe.associado.cidade}/${detalhe.associado.uf}` : null} />
                    <Info label="Plano" value={(detalhe.associado as any).planos?.nome} />
                    <Info label="Data Adesão" value={formatDate(detalhe.associado.data_adesao)} />
                    <Info label="Cód. Hinova" value={detalhe.associado.codigo_hinova} />
                    <Info label="Dia Vencimento" value={detalhe.associado.dia_vencimento} />
                  </div>
                </TabsContent>
                <TabsContent value="veiculos" className="mt-4">
                  {detalhe.veiculos.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum veículo vinculado</p>
                  ) : (
                    <div className="space-y-3">
                      {detalhe.veiculos.map((v: any) => (
                        <Card key={v.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4 text-muted-foreground" />
                                <span className="font-bold font-mono">{v.placa}</span>
                                <Badge className={STATUS_COLORS[v.status] || ''}>{v.status}</Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <Info label="Marca/Modelo" value={`${v.marca} ${v.modelo}`} />
                              <Info label="Ano" value={`${v.ano_fabricacao}/${v.ano_modelo}`} />
                              <Info label="Cor" value={v.cor} />
                              <Info label="Chassi" value={v.chassi} />
                              <Info label="FIPE" value={v.valor_fipe ? formatCurrency(v.valor_fipe) : null} />
                              {v.rastreador && (
                                <div className="flex items-center gap-1">
                                  <Radio className="h-3 w-3 text-green-600" />
                                  <span className="text-xs">{v.rastreador.codigo} ({v.rastreador.plataforma || 'N/A'})</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="boletos" className="mt-4">
                  {detalhe.cobrancas.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum boleto encontrado</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Referência</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalhe.cobrancas.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.referencia || c.tipo}</TableCell>
                            <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                            <TableCell>{formatCurrency(c.valor)}</TableCell>
                            <TableCell><Badge variant={c.status === 'RECEIVED' || c.status === 'CONFIRMED' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                            <TableCell>{formatDate(c.data_pagamento)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Detail Modal - Veículo */}
      <VeiculoDetalhesModal
        open={!!selectedVeiculoId}
        onClose={() => setSelectedVeiculoId(null)}
        veiculoId={selectedVeiculoId || ''}
      />

      {/* Confirmation Dialog - Delete */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deleteConfirm?.tipo === 'associado' ? 'o associado' : 'o veículo'}{' '}
              <strong>{deleteConfirm?.nome}</strong> da base antiga?
              {deleteConfirm?.tipo === 'associado' && ' Todos os veículos vinculados também serão excluídos.'}
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
