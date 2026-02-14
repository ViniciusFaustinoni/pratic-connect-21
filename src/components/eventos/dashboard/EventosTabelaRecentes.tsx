import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useEventosRecentes, FiltrosGlobais } from '@/hooks/useEventosDashboard';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  comunicado: { label: 'Comunicado', class: 'bg-gray-100 text-gray-800' },
  documentacao_pendente: { label: 'Doc. Pendente', class: 'bg-yellow-100 text-yellow-800' },
  aguardando_vistoria: { label: 'Aguard. Vistoria', class: 'bg-sky-100 text-sky-800' },
  em_vistoria: { label: 'Em Vistoria', class: 'bg-sky-100 text-sky-800' },
  aguardando_analise: { label: 'Aguard. Análise', class: 'bg-purple-100 text-purple-800' },
  em_analise: { label: 'Em Análise', class: 'bg-purple-100 text-purple-800' },
  aguardando_parecer: { label: 'Aguard. Parecer', class: 'bg-purple-100 text-purple-800' },
  analise_interna: { label: 'Análise Interna', class: 'bg-purple-100 text-purple-800' },
  aprovado: { label: 'Aprovado', class: 'bg-green-100 text-green-800' },
  negado: { label: 'Negado', class: 'bg-red-100 text-red-800' },
  reprovado: { label: 'Reprovado', class: 'bg-red-100 text-red-800' },
  em_recuperacao: { label: 'Em Recuperação', class: 'bg-violet-100 text-violet-800' },
  pronto_para_oficina: { label: 'Pronto p/ Oficina', class: 'bg-cyan-100 text-cyan-800' },
  em_regulacao: { label: 'Em Regulação', class: 'bg-indigo-100 text-indigo-800' },
  em_reparo: { label: 'Em Reparo', class: 'bg-indigo-100 text-indigo-800' },
  aguardando_peca: { label: 'Aguard. Peça', class: 'bg-orange-100 text-orange-800' },
  aguardando_cota: { label: 'Aguard. Cota', class: 'bg-green-100 text-green-800' },
  aguardando_termo: { label: 'Aguard. Termo', class: 'bg-green-100 text-green-800' },
  em_garantia: { label: 'Em Garantia', class: 'bg-lime-100 text-lime-800' },
  encerrado: { label: 'Encerrado', class: 'bg-emerald-100 text-emerald-800' },
  pago: { label: 'Pago', class: 'bg-emerald-100 text-emerald-800' },
  indenizado: { label: 'Indenizado', class: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', class: 'bg-slate-100 text-slate-800' },
  em_sindicancia: { label: 'Em Sindicância', class: 'bg-amber-100 text-amber-800' },
  em_pericia: { label: 'Em Perícia', class: 'bg-amber-100 text-amber-800' },
  suspenso: { label: 'Suspenso', class: 'bg-slate-100 text-slate-800' },
  pagamento_confirmado: { label: 'Pagamento Confirmado', class: 'bg-emerald-100 text-emerald-800' },
};

const TIPO_BADGE: Record<string, { label: string; class: string }> = {
  colisao: { label: 'Colisão', class: 'bg-blue-100 text-blue-800' },
  roubo: { label: 'Roubo', class: 'bg-red-100 text-red-800' },
  furto: { label: 'Furto', class: 'bg-violet-100 text-violet-800' },
  incendio: { label: 'Incêndio', class: 'bg-orange-100 text-orange-800' },
  fenomeno_natural: { label: 'Alagamento', class: 'bg-cyan-100 text-cyan-800' },
  vidros: { label: 'Vidros', class: 'bg-green-100 text-green-800' },
};

interface Props {
  filtros: FiltrosGlobais;
  faseFilter?: string[];
}

export default function EventosTabelaRecentes({ filtros, faseFilter }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useEventosRecentes(filtros, faseFilter);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Eventos Recentes</CardTitle>
          <Button size="sm" onClick={() => navigate('/eventos/sinistros/novo')}>
            <Plus className="h-4 w-4 mr-1" /> Novo Evento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Dias</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s: any) => {
                  const status = STATUS_CONFIG[s.status] || { label: s.status, class: 'bg-gray-100 text-gray-800' };
                  const tipo = TIPO_BADGE[s.tipo] || { label: s.tipo, class: 'bg-gray-100 text-gray-800' };
                  const diasAberto = differenceInDays(new Date(), new Date(s.created_at));
                  const atualizado = formatDistanceToNow(new Date(s.updated_at), { locale: ptBR, addSuffix: true });

                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/eventos/sinistros/${s.id}`)}>
                      <TableCell className="font-medium text-primary">{s.protocolo}</TableCell>
                      <TableCell><Badge className={tipo.class}>{tipo.label}</Badge></TableCell>
                      <TableCell className="max-w-[120px] truncate">{s.associado?.nome || '-'}</TableCell>
                      <TableCell>
                        {s.veiculo?.placa || '-'}
                        {s.veiculo?.modelo && (
                          <span className="text-muted-foreground text-xs ml-1">({s.veiculo.modelo})</span>
                        )}
                      </TableCell>
                      <TableCell><Badge className={status.class}>{status.label}</Badge></TableCell>
                      <TableCell className="text-center">{diasAberto}d</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{atualizado}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/eventos/sinistros/${s.id}`); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum evento encontrado
          </div>
        )}
        {data && data.length > 0 && (
          <div className="flex justify-end mt-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/eventos/sinistros')}>
              Ver todos os eventos
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
