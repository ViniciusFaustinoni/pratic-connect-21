import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle, Calendar, Car, CheckCircle2, Clock, FileText,
  Image, MapPin, MessageSquare, Shield, Upload, Video, Wrench,
  Send, DollarSign, ClipboardCheck, Camera
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
}

export function TimelineEventoTab({ sinistroId }: { sinistroId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['timeline-evento', sinistroId],
    queryFn: async () => {
      const timeline: TimelineItem[] = [];

      // 1. Sinistro data
      const { data: sinistro } = await supabase
        .from('sinistros')
        .select('id, created_at, data_ocorrencia, protocolo, status, tipo')
        .eq('id', sinistroId)
        .single();

      if (sinistro) {
        if (sinistro.data_ocorrencia) {
          timeline.push({
            id: 'evento', date: sinistro.data_ocorrencia,
            title: 'Evento ocorrido', description: `Tipo: ${sinistro.tipo}`,
            icon: AlertTriangle, color: 'text-red-500',
          });
        }
        timeline.push({
          id: 'comunicado', date: sinistro.created_at,
          title: 'Comunicação registrada', description: `Protocolo: ${sinistro.protocolo}`,
          icon: FileText, color: 'text-blue-500', badge: 'Comunicado', badgeColor: 'bg-blue-100 text-blue-800',
        });
      }

      // 2. Histórico do sinistro
      const { data: historico } = await supabase
        .from('sinistro_historico')
        .select('id, created_at, status_anterior, status_novo, observacao')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      historico?.forEach((h) => {
        timeline.push({
          id: `hist-${h.id}`, date: h.created_at!,
          title: `Status: ${h.status_novo}`,
          description: h.observacao || `${h.status_anterior || '—'} → ${h.status_novo}`,
          icon: Clock, color: 'text-gray-500',
        });
      });

      // 3. Links do evento
      const { data: links } = await supabase
        .from('sinistro_evento_links')
        .select('id, created_at, tipo, status')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      links?.forEach((l) => {
        timeline.push({
          id: `link-${l.id}`, date: l.created_at!,
          title: `Link ${l.tipo} enviado`, description: `Status: ${l.status}`,
          icon: Send, color: 'text-purple-500',
        });
      });

      // 4. Vistorias
      const { data: vistorias } = await supabase
        .from('vistorias_evento')
        .select('id, created_at, data_agendada, status')
        .eq('sinistro_id', sinistroId)
        .order('created_at');

      vistorias?.forEach((v) => {
        timeline.push({
          id: `vistoria-${v.id}`, date: v.created_at!,
          title: 'Vistoria do evento', description: `Status: ${v.status}`,
          icon: ClipboardCheck, color: 'text-teal-500',
          badge: v.status, badgeColor: v.status === 'concluida' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
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

        // Atualizações diárias da OS
        supabase
          .from('os_atualizacoes_diarias')
          .select('id, created_at, descricao, etapa_concluida, tem_problema, tipo_problema')
          .eq('ordem_servico_id', os.id)
          .order('created_at')
          .then(({ data: atualizacoes }) => {
            // Note: this won't affect the already rendered timeline since it's async
            // In a real scenario we'd want to fetch all in parallel
          });
      });

      // 6b. Atualizações diárias
      const osIds = ordens?.map((o) => o.id) || [];
      if (osIds.length > 0) {
        const { data: atualizacoes } = await supabase
          .from('os_atualizacoes_diarias')
          .select('id, created_at, descricao, etapa_concluida, tem_problema, tipo_problema')
          .in('ordem_servico_id', osIds)
          .order('created_at');

        atualizacoes?.forEach((a) => {
          timeline.push({
            id: `atualizacao-${a.id}`, date: a.created_at!,
            title: a.etapa_concluida ? `Etapa "${a.etapa_concluida}" concluída` : 'Atualização diária',
            description: a.descricao,
            icon: a.tem_problema ? AlertTriangle : Camera,
            color: a.tem_problema ? 'text-red-500' : 'text-gray-500',
            badge: a.tem_problema ? a.tipo_problema || 'Problema' : undefined,
            badgeColor: a.tem_problema ? 'bg-red-100 text-red-800' : undefined,
          });
        });

        // Vistorias presenciais
        const { data: vistoriasP } = await supabase
          .from('os_vistorias_presenciais')
          .select('id, created_at, observacoes')
          .in('ordem_servico_id', osIds)
          .order('created_at');

        vistoriasP?.forEach((vp) => {
          timeline.push({
            id: `vp-${vp.id}`, date: vp.created_at!,
            title: 'Vistoria presencial do regulador',
            description: vp.observacoes || undefined,
            icon: Video, color: 'text-violet-500',
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
          return (
            <div key={item.id} className="relative flex gap-3 pb-4">
              <div className={`absolute left-[-13px] mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 ${item.color.replace('text-', 'border-')}`}>
                <Icon className={`h-3 w-3 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0 ml-2">
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
