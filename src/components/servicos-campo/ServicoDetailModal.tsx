import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  User, Car, MapPin, Phone, Calendar, Clock, FileText,
  MessageSquare, Navigation, ExternalLink, Cpu, AlertTriangle,
  DollarSign, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TIPO_SERVICO_LABELS, STATUS_SERVICO_LABELS, STATUS_SERVICO_COLORS,
  PERIODO_LABELS,
  type Servico,
} from '@/hooks/useServicos';
import { MOTIVO_RETIRADA_LABELS, INTEGRIDADE_APARELHO_LABELS, INTEGRIDADE_APARELHO_COLORS } from '@/types/retirada';
import { ServicoTipoBadge } from './ServicoTipoBadge';

interface ServicoDetailModalProps {
  servico: Servico | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServicoDetailModal({ servico, open, onOpenChange }: ServicoDetailModalProps) {
  if (!servico) return null;

  const isRetirada = servico.tipo === 'vistoria_retirada';
  const isInstalacao = servico.tipo === 'instalacao' || servico.tipo === 'revistoria';
  const motivoRetirada = (servico as any).motivo_retirada;
  const multaAplicada = (servico as any).multa_aplicada;
  const integridade = (servico as any).integridade_aparelho;
  const enderecoCompleto = [
    servico.logradouro,
    servico.numero,
    servico.complemento,
    servico.bairro,
    servico.cidade,
    servico.uf,
    servico.cep,
  ].filter(Boolean).join(', ');

  const wppNumero = (servico.associado?.whatsapp || servico.associado?.telefone || '').replace(/\D/g, '');
  const mapsUrl = enderecoCompleto
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <ServicoTipoBadge servico={servico} />
            <Badge className={cn('text-xs border-transparent', STATUS_SERVICO_COLORS[servico.status])}>
              {STATUS_SERVICO_LABELS[servico.status]}
            </Badge>
            {servico.protocolo && (
              <span className="text-sm font-mono text-muted-foreground">
                {servico.protocolo}
              </span>
            )}
          </DialogTitle>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {wppNumero && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={`https://wa.me/55${wppNumero}`} target="_blank" rel="noreferrer">
                  <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </Button>
            )}
            {mapsUrl && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={mapsUrl} target="_blank" rel="noreferrer">
                  <Navigation className="h-3.5 w-3.5" /> Maps
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href="/monitoramento/mapa" target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Ver no mapa
              </a>
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="mx-6 mt-4">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="cliente">Cliente & Veículo</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              {isRetirada && <TabsTrigger value="retirada">Retirada</TabsTrigger>}
              {isInstalacao && <TabsTrigger value="rastreador">Rastreador</TabsTrigger>}
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            {/* RESUMO */}
            <TabsContent value="resumo" className="p-6 space-y-4">
              <Section title="Agendamento" icon={Calendar}>
                <Field label="Data" value={servico.data_agendada ? format(new Date(servico.data_agendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '—'} />
                <Field label="Período" value={servico.periodo ? PERIODO_LABELS[servico.periodo] : '—'} />
                <Field label="Hora" value={servico.hora_agendada?.slice(0, 5) || '—'} />
                <Field label="Permite encaixe" value={servico.permite_encaixe ? 'Sim' : 'Não'} />
              </Section>

              {servico.observacoes && (
                <Section title="Observações" icon={Info}>
                  <p className="text-sm whitespace-pre-wrap">{servico.observacoes}</p>
                </Section>
              )}

              {servico.profissional && (
                <Section title="Técnico atribuído" icon={User}>
                  <Field label="Nome" value={servico.profissional.nome} />
                  {servico.profissional.telefone && (
                    <Field label="Telefone" value={servico.profissional.telefone} />
                  )}
                </Section>
              )}
            </TabsContent>

            {/* CLIENTE & VEÍCULO */}
            <TabsContent value="cliente" className="p-6 space-y-4">
              <Section title="Cliente" icon={User}>
                <Field label="Nome" value={servico.associado?.nome || '—'} />
                <Field label="CPF" value={servico.associado?.cpf || '—'} />
                <Field label="Telefone" value={servico.associado?.telefone || '—'} />
                <Field label="WhatsApp" value={servico.associado?.whatsapp || '—'} />
                <Field label="E-mail" value={servico.associado?.email || '—'} />
              </Section>

              <Section title="Veículo" icon={Car}>
                <Field label="Placa" value={servico.veiculo?.placa || '—'} mono />
                <Field label="Marca / Modelo" value={`${servico.veiculo?.marca || ''} ${servico.veiculo?.modelo || ''}`.trim() || '—'} />
                <Field label="Ano" value={`${servico.veiculo?.ano_fabricacao || '—'} / ${servico.veiculo?.ano_modelo || '—'}`} />
                <Field label="Cor" value={servico.veiculo?.cor || '—'} />
              </Section>
            </TabsContent>

            {/* ENDEREÇO */}
            <TabsContent value="endereco" className="p-6 space-y-4">
              <Section title="Local do serviço" icon={MapPin}>
                <Field label="CEP" value={servico.cep || '—'} mono />
                <Field label="Logradouro" value={servico.logradouro || '—'} />
                <Field label="Número" value={servico.numero || '—'} />
                <Field label="Complemento" value={servico.complemento || '—'} />
                <Field label="Bairro" value={servico.bairro || '—'} />
                <Field label="Cidade / UF" value={`${servico.cidade || '—'} / ${servico.uf || '—'}`} />
                {servico.local_vistoria && (
                  <Field label="Local da vistoria" value={servico.local_vistoria} />
                )}
              </Section>
            </TabsContent>

            {/* RETIRADA */}
            {isRetirada && (
              <TabsContent value="retirada" className="p-6 space-y-4">
                <Section title="Detalhes da retirada" icon={AlertTriangle}>
                  {motivoRetirada && (
                    <Field label="Motivo" value={MOTIVO_RETIRADA_LABELS[motivoRetirada as keyof typeof MOTIVO_RETIRADA_LABELS] || motivoRetirada} />
                  )}
                  <Field label="Solicitado por" value={(servico as any).solicitado_por_modulo || '—'} />
                  {integridade && (
                    <div>
                      <Label>Integridade do aparelho</Label>
                      <Badge className={cn('text-xs', INTEGRIDADE_APARELHO_COLORS[integridade as keyof typeof INTEGRIDADE_APARELHO_COLORS])}>
                        {INTEGRIDADE_APARELHO_LABELS[integridade as keyof typeof INTEGRIDADE_APARELHO_LABELS]}
                      </Badge>
                    </div>
                  )}
                  {multaAplicada && (
                    <div>
                      <Label>Multa</Label>
                      <Badge variant="destructive" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        {(servico as any).multa_valor
                          ? `R$ ${Number((servico as any).multa_valor).toFixed(2)}`
                          : 'Aplicada'}
                      </Badge>
                      {(servico as any).multa_motivo && (
                        <p className="text-xs text-muted-foreground mt-1">{(servico as any).multa_motivo}</p>
                      )}
                    </div>
                  )}
                </Section>
              </TabsContent>
            )}

            {/* RASTREADOR */}
            {isInstalacao && (
              <TabsContent value="rastreador" className="p-6 space-y-4">
                <Section title="Rastreador" icon={Cpu}>
                  <Field label="ID" value={servico.rastreador_id || '—'} mono />
                  <Field label="IMEI" value={servico.imei_rastreador || '—'} mono />
                  <Field label="Quilometragem" value={servico.quilometragem ? `${servico.quilometragem} km` : '—'} />
                </Section>
              </TabsContent>
            )}

            {/* HISTÓRICO */}
            <TabsContent value="historico" className="p-6 space-y-4">
              <Section title="Linha do tempo" icon={Clock}>
                <Timeline label="Criado" date={servico.created_at} />
                <Timeline label="Em rota" date={servico.em_rota_em} />
                <Timeline label="Iniciado" date={servico.iniciada_em} />
                <Timeline label="Concluído" date={servico.concluida_em} />
                {servico.analisado_em && (
                  <Timeline label="Analisado" date={servico.analisado_em} />
                )}
              </Section>

              {servico.observacoes_analise && (
                <Section title="Observações da análise" icon={FileText}>
                  <p className="text-sm whitespace-pre-wrap">{servico.observacoes_analise}</p>
                </Section>
              )}

              {servico.motivo_reprovacao && (
                <Section title="Motivo da reprovação" icon={AlertTriangle}>
                  <p className="text-sm whitespace-pre-wrap text-destructive">{servico.motivo_reprovacao}</p>
                </Section>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={cn('text-sm', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Timeline({ label, date }: { label: string; date: string | null }) {
  if (!date) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className="text-muted-foreground">
        {format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </span>
    </div>
  );
}
