import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/UserAvatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, FileSearch, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AuditoriaRegistro } from '@/hooks/useComissoesExtended';
import type { ComissaoPagamento } from '@/types/comissoes';
import { Skeleton } from '@/components/ui/skeleton';

interface ComissoesHistoricoTabProps {
  auditoria: AuditoriaRegistro[];
  pagamentos: ComissaoPagamento[];
  isLoadingAuditoria: boolean;
  isLoadingPagamentos: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const acaoLabels: Record<string, { label: string; color: string }> = {
  insert: { label: 'Criação', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  update: { label: 'Atualização', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  delete: { label: 'Exclusão', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  fechamento: { label: 'Fechamento', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
};

function AuditoriaDetailDialog({ registro }: { registro: AuditoriaRegistro }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Alteração</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Tabela</p>
              <p className="font-medium">{registro.tabela}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ação</p>
              <Badge className={acaoLabels[registro.acao]?.color || ''}>
                {acaoLabels[registro.acao]?.label || registro.acao}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-medium">
                {format(new Date(registro.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Usuário</p>
              <p className="font-medium">{registro.usuario_nome || 'Sistema'}</p>
            </div>
          </div>

          {registro.dados_anteriores && (
            <div>
              <p className="text-sm font-medium mb-2">Dados Anteriores</p>
              <ScrollArea className="h-[150px] rounded border p-3 bg-red-50/50 dark:bg-red-950/20">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(registro.dados_anteriores, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}

          {registro.dados_novos && (
            <div>
              <p className="text-sm font-medium mb-2">Dados Novos</p>
              <ScrollArea className="h-[150px] rounded border p-3 bg-green-50/50 dark:bg-green-950/20">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(registro.dados_novos, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ComissoesHistoricoTab({
  auditoria,
  pagamentos,
  isLoadingAuditoria,
  isLoadingPagamentos,
}: ComissoesHistoricoTabProps) {
  return (
    <Tabs defaultValue="auditoria" className="w-full">
      <TabsList>
        <TabsTrigger value="auditoria">
          <FileSearch className="h-4 w-4 mr-2" />
          Auditoria
        </TabsTrigger>
        <TabsTrigger value="pagamentos">
          <History className="h-4 w-4 mr-2" />
          Histórico de Pagamentos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="auditoria" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas Alterações</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAuditoria ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : auditoria.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum registro de auditoria encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoria.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        {format(new Date(a.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{a.usuario_nome || 'Sistema'}</TableCell>
                      <TableCell className="font-mono text-xs">{a.tabela}</TableCell>
                      <TableCell>
                        <Badge className={acaoLabels[a.acao]?.color || ''}>
                          {acaoLabels[a.acao]?.label || a.acao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <AuditoriaDetailDialog registro={a} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pagamentos" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPagamentos ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : pagamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum pagamento registrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Mês/Ano</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Comprovante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            src={p.vendedor?.avatar_url}
                            name={p.vendedor?.nome || ''}
                            size="sm"
                          />
                          <span className="truncate max-w-[150px]">
                            {p.vendedor?.nome || 'Desconhecido'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(p.ano_referencia, p.mes_referencia - 1), 'MMM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">{p.quantidade_comissoes}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.valor_total)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(p.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {p.comprovante_url ? (
                          <a 
                            href={p.comprovante_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            Ver
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
