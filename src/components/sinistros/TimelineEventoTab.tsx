import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle, Calendar, Car, CheckCircle2, Clock, FileText,
  Image, MapPin, MessageSquare, Shield, Upload, Video, Wrench,
  Send, DollarSign, ClipboardCheck, Camera, ChevronDown, ChevronRight,
  CreditCard, PenTool, Users, Building2, Store
} from 'lucide-react';

interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
  badgeColor?: string;
  fotos?: string[];
  videoUrl?: string;
  expandable?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  comunicado: 'Comunicado',
  em_analise: 'Em Análise',
  aguardando_analise: 'Aguardando Análise',
  aguardando_vistoria: 'Aguardando Vistoria',
  em_vistoria: 'Em Vistoria',
  aguardando_parecer: 'Aguardando Parecer',
  aprovado: 'Aprovado',
  negado: 'Negado',
  em_regulacao: 'Em Regulação',
  em_reparo: 'Em Reparo',
  aguardando_diretoria: 'Aguardando Diretoria',
  em_sindicancia: 'Em Sindicância',
  suspensa: 'Suspensa',
  pago: 'Pago',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
  agendada: 'Agendada',
  concluida: 'Concluída',
  em_andamento: 'Em Andamento',
};

const getLabel = (status: string) => STATUS_LABELS[status] || status;

export function TimelineEventoTab({ sinistroId }: { sinistroId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['timeline-evento', sinistroId],
    queryFn: async () => {
      const timeline: TimelineItem[] = [];

      // 1. Sinistro data
      const { data: sinistroRaw } = await supabase
        .from('sinistros')
        .select('*')
        .eq('id', sinistroId)
        .single();

      const sinistro = sinistroRaw as any;

      if (sinistro) {
        if (sinistro.data_ocorrencia) {
          timeline.push({
            id: 'evento', date: sinistro.data_ocorrencia,
            title: 'Evento ocorrido', description: `Tipo: ${sinistro.tipo}`,
            icon: AlertTriangle, color: 'text-red-500',
          });
        }

        // Correção 4: Calcular tempo entre evento e comunicação
        let descComunicacao = `Protocolo: ${sinistro.protocolo}`;
        if (sinistro.data_ocorrencia && sinistro.created_at) {
          const diffMin = differenceInMinutes(new Date(sinistro.created_at), new Date(sinistro.data_ocorrencia));
          const diffH = Math.floor(diffMin / 60);
          const restMin = diffMin % 60;
          descComunicacao += ` • Tempo até comunicação: ${diffH > 0 ? `${diffH}h ` : ''}${restMin}min`;
        }

        timeline.push({
          id: 'comunicado', date: sinistro.created_at,
          title: 'Comunicação registrada', description: descComunicacao,
          icon: FileText, color: 'text-blue-500', badge: 'Comunicado', badgeColor: 'bg-blue-100 text-blue-800',
        });

        // Correção 4: Pagamento confirmado
        if (sinistro.cota_paga_em) {
          timeline.push({
            id: 'pagamento', date: sinistro.cota_paga_em,
            title: 'Pagamento da cota confirmado',
            icon: CreditCard, color: 'text-green-600',
            badge: 'Pago', badgeColor: 'bg-green-100 text-green-800',
          });
        }

        // Correção 4: Termo enviado
        if (sinistro.termo_anuencia_criado_em) {
          timeline.push({
            id: 'termo-enviado', date: sinistro.termo_anuencia_criado_em,
            title: 'Termo de anuência enviado (Autentique)',
            icon: PenTool, color: 'text-indigo-500',
          });
        }

        // Correção 4: Termo assinado
        if (sinistro.termo_anuencia_assinado_em) {
          timeline.push({
            id: 'termo-assinado', date: sinistro.termo_anuencia_assinado_em,
            title: 'Termo de anuência assinado',
            icon: PenTool, color: 'text-green-600',
            badge: 'Assinado', badgeColor: 'bg-green-100 text-green-800',
          });
        }
      }

      // 2. Histórico do sinistro (inclui atribuição de fornecedores)
      const { data: historico } = await supabase
        .from('sinistro_historico')
        .select('id, created_at, status_anterior, status_novo, observacao')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      historico?.forEach((h) => {
        const isAtribuicao = h.observacao && (
          h.observacao.toLowerCase().includes('oficina') ||
          h.observacao.toLowerCase().includes('fornecedor') ||
          h.observacao.toLowerCase().includes('prestador')
        );
        timeline.push({
          id: `hist-${h.id}`, date: h.created_at!,
          title: isAtribuicao ? 'Atribuição de fornecedores' : `Status: ${getLabel(h.status_novo)}`,
          description: h.observacao || `${h.status_anterior ? getLabel(h.status_anterior) : '—'} → ${getLabel(h.status_novo)}`,
          icon: isAtribuicao ? Building2 : Clock,
          color: isAtribuicao ? 'text-teal-600' : 'text-gray-500',
        });
      });

      // 3. Links do evento (diferenciando Link 1, Link 2, Link 3)
      const { data: links } = await supabase
        .from('sinistro_evento_links')
        .select('id, created_at, tipo, status, etapa_atual, etapa1_completada_em, etapa2_completada_em, etapa3_completada_em, etapa4_completada_em')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      links?.forEach((l: any) => {
        const tipoLabel = l.tipo === 'pagamento' ? 'Link 2 (Pagamento)'
          : l.tipo === 'retirada' ? 'Link 3 (Retirada)'
          : 'Link 1 (Documentação)';
        timeline.push({
          id: `link-${l.id}`, date: l.created_at!,
          title: `${tipoLabel} enviado`, description: `Status: ${l.status}`,
          icon: Send, color: 'text-purple-500',
        });

        if (l.etapa1_completada_em) {
          timeline.push({
            id: `link-etapa1-${l.id}`, date: l.etapa1_completada_em,
            title: 'Auto Vistoria concluída pelo associado',
            icon: Car, color: 'text-emerald-500',
          });
        }
        if (l.etapa2_completada_em) {
          timeline.push({
            id: `link-etapa2-${l.id}`, date: l.etapa2_completada_em,
            title: 'B.O. enviado pelo associado',
            icon: FileText, color: 'text-blue-500',
          });
        }
        if (l.etapa3_completada_em) {
          timeline.push({
            id: `link-etapa3-${l.id}`, date: l.etapa3_completada_em,
            title: 'Relato enviado pelo associado',
            icon: MessageSquare, color: 'text-indigo-500',
          });
        }
        if (l.etapa4_completada_em) {
          timeline.push({
            id: `link-etapa4-${l.id}`, date: l.etapa4_completada_em,
            title: 'Agendamento realizado pelo associado',
            icon: Calendar, color: 'text-green-600',
            badge: 'Agendado', badgeColor: 'bg-green-100 text-green-800',
          });
        }
      });

      // 4. Vistorias
      const { data: vistorias } = await supabase
        .from('vistorias_evento')
        .select('id, created_at, data_agendada, status')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      vistorias?.forEach((v) => {
        if (v.data_agendada) {
          timeline.push({
            id: `vistoria-ag-${v.id}`, date: v.created_at!,
            title: 'Vistoria agendada',
            description: `Para: ${format(new Date(v.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}`,
            icon: Calendar, color: 'text-orange-500',
          });
        }
        timeline.push({
          id: `vistoria-${v.id}`, date: v.created_at!,
          title: 'Vistoria do evento', description: `Status: ${getLabel(v.status)}`,
          icon: ClipboardCheck, color: 'text-teal-500',
          badge: getLabel(v.status), badgeColor: v.status === 'concluida' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
        });
      });

      // 5. Cotações de peças
      const { data: cotacoes } = await supabase
        .from('evento_cotacoes_pecas')
        .select('id, created_at, auto_center_id, status, updated_at')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      cotacoes?.forEach((c) => {
        timeline.push({
          id: `cotacao-${c.id}`, date: c.created_at!,
          title: 'Cotação de peças enviada',
          icon: DollarSign, color: 'text-orange-500',
          badge: c.status, badgeColor: c.status === 'aprovada' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
        });
        if (c.status === 'aprovada' && c.updated_at) {
          timeline.push({
            id: `cotacao-aprov-${c.id}`, date: c.updated_at,
            title: 'Cotação aprovada',
            icon: CheckCircle2, color: 'text-green-600',
            badge: 'Aprovada', badgeColor: 'bg-green-100 text-green-800',
          });
        }
      });

      // 6. Ordens de serviço
      const { data: ordens } = await supabase
        .from('ordens_servico')
        .select('id, numero, created_at, data_entrada, data_conclusao_real, data_retirada, garantia_ate, status')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      ordens?.forEach((os) => {
        timeline.push({
          id: `os-${os.id}`, date: os.created_at!,
          title: `OS ${os.numero || ''} gerada`, icon: Wrench, color: 'text-indigo-500',
          badge: os.status,
        });
        if (os.data_entrada) {
          timeline.push({
            id: `os-entrada-${os.id}`, date: os.data_entrada,
            title: 'Veículo deu entrada na oficina', icon: Car, color: 'text-emerald-500',
          });
        }
        if (os.data_conclusao_real) {
          timeline.push({
            id: `os-concluido-${os.id}`, date: os.data_conclusao_real,
            title: 'Reparo concluído', icon: CheckCircle2, color: 'text-green-500',
            badge: 'Concluído', badgeColor: 'bg-green-100 text-green-800',
          });
        }
        if (os.data_retirada) {
          timeline.push({
            id: `os-retirada-${os.id}`, date: os.data_retirada,
            title: 'Veículo retirado pelo associado', icon: Car, color: 'text-blue-600',
            badge: 'Entregue', badgeColor: 'bg-blue-100 text-blue-800',
          });
        }
        if (os.garantia_ate) {
          timeline.push({
            id: `os-garantia-${os.id}`, date: os.data_retirada || os.data_conclusao_real || os.created_at!,
            title: `Garantia de 90 dias até ${format(new Date(os.garantia_ate), 'dd/MM/yyyy')}`,
            icon: Shield, color: 'text-amber-500',
          });
        }
      });

      // 6b. Atualizações diárias (com fotos e vídeo para expandir)
      const osIds = ordens?.map((o) => o.id) || [];
      if (osIds.length > 0) {
        const { data: atualizacoes } = await supabase
          .from('os_atualizacoes_diarias')
          .select('id, created_at, descricao, etapa_concluida, tem_problema, tipo_problema, fotos_urls, video_url')
          .in('ordem_servico_id', osIds)
          .order('created_at');

        atualizacoes?.forEach((a: any) => {
          const hasFotos = a.fotos_urls && a.fotos_urls.length > 0;
          const hasVideo = !!a.video_url;
          timeline.push({
            id: `atualizacao-${a.id}`, date: a.created_at!,
            title: a.etapa_concluida ? `Etapa "${a.etapa_concluida}" concluída` : 'Atualização diária',
            description: a.descricao,
            icon: a.tem_problema ? AlertTriangle : Camera,
            color: a.tem_problema ? 'text-red-500' : 'text-gray-500',
            badge: a.tem_problema ? a.tipo_problema || 'Problema' : undefined,
            badgeColor: a.tem_problema ? 'bg-red-100 text-red-800' : undefined,
            fotos: hasFotos ? a.fotos_urls : undefined,
            videoUrl: hasVideo ? a.video_url : undefined,
            expandable: hasFotos || hasVideo,
          });
        });

        // Vistorias presenciais (com vídeo para expandir)
        const { data: vistoriasP } = await supabase
          .from('os_vistorias_presenciais')
          .select('id, created_at, observacoes, video_url')
          .in('ordem_servico_id', osIds)
          .order('created_at');

        vistoriasP?.forEach((vp: any) => {
          const hasVideo = !!vp.video_url;
          timeline.push({
            id: `vp-${vp.id}`, date: vp.created_at!,
            title: 'Vistoria presencial do regulador',
            description: vp.observacoes || undefined,
            icon: Video, color: 'text-violet-500',
            videoUrl: hasVideo ? vp.video_url : undefined,
            expandable: hasVideo,
          });
        });
      }

      // Sort by date
      return timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Carregando timeline...</div>;
  if (items.length === 0) return <div className="py-8 text-center text-muted-foreground">Nenhum evento registrado</div>;

  return (
    <ScrollArea className="h-[60vh]">
      <div className="relative pl-6 space-y-0">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
        {items.map((item) => {
          const Icon = item.icon;
          const isExpanded = expandedId === item.id;

          return (
            <div key={item.id} className="relative flex gap-3 pb-4">
              <div className={`absolute left-[-13px] mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 ${item.color.replace('text-', 'border-')}`}>
                <Icon className={`h-3 w-3 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0 ml-2">
                {item.expandable ? (
                  <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : item.id)}>
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-center gap-2 flex-wrap cursor-pointer hover:opacity-80">
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-sm font-medium">{item.title}</span>
                        {item.badge && (
                          <Badge variant="outline" className={`text-[10px] ${item.badgeColor || ''}`}>
                            {item.badge}
                          </Badge>
                        )}
                        {item.fotos && <Badge variant="outline" className="text-[9px]"><Image className="h-2.5 w-2.5 mr-0.5" />{item.fotos.length}</Badge>}
                        {item.videoUrl && <Badge variant="outline" className="text-[9px]"><Video className="h-2.5 w-2.5 mr-0.5" />Vídeo</Badge>}
                      </div>
                    </CollapsibleTrigger>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <CollapsibleContent>
                      <div className="mt-2 space-y-2">
                        {item.fotos && item.fotos.length > 0 && (
                          <div className="grid grid-cols-3 gap-1">
                            {item.fotos.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} className="w-full h-20 object-cover rounded border" alt={`Foto ${i + 1}`} />
                              </a>
                            ))}
                          </div>
                        )}
                        {item.videoUrl && (
                          <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Video className="h-3 w-3" /> Assistir vídeo
                          </a>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.title}</span>
                      {item.badge && (
                        <Badge variant="outline" className={`text-[10px] ${item.badgeColor || ''}`}>
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
