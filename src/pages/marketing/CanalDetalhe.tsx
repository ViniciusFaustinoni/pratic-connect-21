import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Radio, Target, TrendingUp, DollarSign } from 'lucide-react';
import { useCanal, useCampanhas, usePerformanceCanais } from '@/hooks/useMarketing';
import { CanalFormDialog } from '@/components/marketing/CanalFormDialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tipoLabel: Record<string, string> = {
  organico: 'Orgânico', pago: 'Pago', social: 'Social',
  email: 'E-mail', indicacao: 'Indicação', parceria: 'Parceria', outro: 'Outro',
};

export default function CanalDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [openForm, setOpenForm] = useState(false);

  const { data: canal, isLoading } = useCanal(id || '');
  const { data: campanhas } = useCampanhas({ canal_id: id });
  const { data: performance } = usePerformanceCanais();

  const perf = performance?.find(p => p.id === id);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!canal) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Canal não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/marketing/canais')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/marketing/canais')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Radio className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{canal.nome}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{tipoLabel[canal.tipo] || canal.tipo}</Badge>
              {canal.ativo
                ? <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                : <Badge variant="outline">Inativo</Badge>}
            </div>
          </div>
        </div>
        <Button onClick={() => setOpenForm(true)}>
          <Edit className="h-4 w-4 mr-2" /> Editar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Total de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{perf?.total_leads ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Conversões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{perf?.conversoes ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {perf?.taxa_conversao ? `${perf.taxa_conversao.toFixed(1)}% de conversão` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Investimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              R$ {Number(perf?.investimento_total || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CPL Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              R$ {Number(perf?.cpl_medio || 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: {canal.meta_leads_mes ? `${canal.meta_leads_mes}/mês` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {canal.descricao && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{canal.descricao}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas vinculadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!campanhas?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma campanha vinculada a este canal
                  </TableCell>
                </TableRow>
              ) : (
                campanhas.map(c => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/marketing/campanhas/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                    <TableCell>
                      {c.data_inicio
                        ? format(new Date(c.data_inicio), 'dd/MM/yyyy', { locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CanalFormDialog
        open={openForm}
        onClose={() => setOpenForm(false)}
        canal={canal}
      />
    </div>
  );
}
