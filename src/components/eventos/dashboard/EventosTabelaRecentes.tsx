import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Plus, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useEventosRecentes, FiltrosGlobais } from '@/hooks/useEventosDashboard';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  comunicado: { label: 'Comunicado', class: 'bg-slate-100 text-slate-700 border-slate-200' },
  documentacao_pendente: { label: 'Doc. Pendente', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  aguardando_vistoria: { label: 'Aguard. Vistoria', class: 'bg-sky-50 text-sky-700 border-sky-200' },
  em_vistoria: { label: 'Em Vistoria', class: 'bg-sky-50 text-sky-700 border-sky-200' },
  aguardando_analise: { label: 'Aguard. Análise', class: 'bg-violet-50 text-violet-700 border-violet-200' },
  em_analise: { label: 'Em Análise', class: 'bg-violet-50 text-violet-700 border-violet-200' },
  aguardando_parecer: { label: 'Aguard. Parecer', class: 'bg-violet-50 text-violet-700 border-violet-200' },
  analise_interna: { label: 'Análise Interna', class: 'bg-violet-50 text-violet-700 border-violet-200' },
  aprovado: { label: 'Aprovado', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  negado: { label: 'Negado', class: 'bg-red-50 text-red-700 border-red-200' },
  reprovado: { label: 'Reprovado', class: 'bg-red-50 text-red-700 border-red-200' },
  em_recuperacao: { label: 'Em Recuperação', class: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  pronto_para_oficina: { label: 'Pronto p/ Oficina', class: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  em_regulacao: { label: 'Em Regulação', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  em_reparo: { label: 'Em Reparo', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  aguardando_peca: { label: 'Aguard. Peça', class: 'bg-orange-50 text-orange-700 border-orange-200' },
  aguardando_cota: { label: 'Aguard. Cota', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  aguardando_termo: { label: 'Aguard. Termo', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  em_garantia: { label: 'Em Garantia', class: 'bg-lime-50 text-lime-700 border-lime-200' },
  encerrado: { label: 'Encerrado', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pago: { label: 'Pago', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  indenizado: { label: 'Indenizado', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelado: { label: 'Cancelado', class: 'bg-slate-50 text-slate-500 border-slate-200' },
  em_sindicancia: { label: 'Sindicância', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  em_pericia: { label: 'Em Perícia', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  suspenso: { label: 'Suspenso', class: 'bg-slate-50 text-slate-500 border-slate-200' },
  pagamento_confirmado: { label: 'Pag. Confirmado', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const TIPO_BADGE: Record<string, { label: string; class: string }> = {
  colisao: { label: 'Colisão', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  roubo: { label: 'Roubo', class: 'bg-red-50 text-red-700 border-red-200' },
  furto: { label: 'Furto', class: 'bg-violet-50 text-violet-700 border-violet-200' },
  incendio: { label: 'Incêndio', class: 'bg-orange-50 text-orange-700 border-orange-200' },
  fenomeno_natural: { label: 'Alagamento', class: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  vidros: { label: 'Vidros', class: 'bg-green-50 text-green-700 border-green-200' },
};

interface Props {
  filtros: FiltrosGlobais;
  faseFilter?: string[];
}

export default function EventosTabelaRecentes({ filtros, faseFilter }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useEventosRecentes(filtros, faseFilter);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">Eventos Recentes</CardTitle>
              <CardDescription className="text-xs">Últimos 20 eventos atualizados</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/eventos/sinistros/novo')} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo Evento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-xs font-semibold text-muted-foreground pl-6">Protocolo</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Associado</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Veículo</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-center">Dias</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Atualizado</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s: any) => {
                  const status = STATUS_CONFIG[s.status] || { label: s.status, class: 'bg-slate-100 text-slate-700' };
                  const tipo = TIPO_BADGE[s.tipo] || { label: s.tipo, class: 'bg-slate-100 text-slate-700' };
                  const diasAberto = differenceInDays(new Date(), new Date(s.created_at));
                  const atualizado = formatDistanceToNow(new Date(s.updated_at), { locale: ptBR, addSuffix: true });
                  const diasCritico = diasAberto > 30;

                  return (
                    <TableRow 
                      key={s.id} 
                      className="cursor-pointer hover:bg-muted/40 transition-colors border-border/30" 
                      onClick={() => navigate(`/eventos/sinistros/${s.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-semibold text-primary pl-6">{s.protocolo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-medium border ${tipo.class}`}>
                          {tipo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">{s.associado?.nome || '—'}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{s.veiculo?.placa || '—'}</span>
                        {s.veiculo?.modelo && (
                          <span className="text-muted-foreground text-xs ml-1.5">{s.veiculo.modelo}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-medium border ${status.class}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-semibold ${diasCritico ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {diasAberto}d
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{atualizado}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); navigate(`/eventos/sinistros/${s.id}`); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum evento encontrado
          </div>
        )}
        {data && data.length > 0 && (
          <div className="flex justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/eventos/sinistros')} className="text-xs">
              Ver todos os eventos →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
