import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, MoreHorizontal, FileCheck, Calendar,
  FileText, Search, Radio, Wrench, Scale, Plus, Link as LinkIcon,
  Trash2, AlertTriangle, Square, CloudRain, Flame, DollarSign,
  Clock, Package, ShieldAlert, ShieldX, Car, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { BannerAguardandoDiretoria } from '@/components/sinistros/BannerAguardandoDiretoria';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tipoConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  colisao: { label: 'Colisão', icon: Car, color: 'from-blue-600/10 to-blue-600/5 border-blue-500/30' },
  roubo: { label: 'Roubo', icon: ShieldAlert, color: 'from-red-600/10 to-red-600/5 border-red-500/30' },
  furto: { label: 'Furto', icon: ShieldX, color: 'from-orange-600/10 to-orange-600/5 border-orange-500/30' },
  incendio: { label: 'Incêndio', icon: Flame, color: 'from-red-600/10 to-red-600/5 border-red-500/30' },
  fenomeno_natural: { label: 'Fenômeno Natural', icon: CloudRain, color: 'from-cyan-600/10 to-cyan-600/5 border-cyan-500/30' },
  vidros: { label: 'Vidros', icon: Square, color: 'from-cyan-600/10 to-cyan-600/5 border-cyan-500/30' },
  outro: { label: 'Outro', icon: HelpCircle, color: 'from-gray-600/10 to-gray-600/5 border-gray-500/30' },
};

interface SinistroDetalheHeaderProps {
  sinistro: any;
  statusInfo: { label: string; class: string };
  isDiretor: boolean;
  isAnalistaEventosOnly: boolean;
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
  onNavigateBack: () => void;
  onNavigate: (path: string) => void;
  openModalSafely: (setter: (v: boolean) => void) => void;
  setModalStatusOpen: (v: boolean) => void;
  setModalVistoriaOpen: (v: boolean) => void;
  setModalParecerOpen: (v: boolean) => void;
  setModalSindicanciaOpen: (v: boolean) => void;
  setModalAcionamentoOpen: (v: boolean) => void;
  setModalExcluirOpen: (v: boolean) => void;
  setModalVincularOpen: (v: boolean) => void;
  setModalJuridicoOpen: (v: boolean) => void;
  setShowAtribuirFornecedores: (v: boolean) => void;
  handleWhatsApp: (phone: string | null) => void;
}

export function SinistroDetalheHeader({
  sinistro, statusInfo, isDiretor, isAnalistaEventosOnly,
  dropdownOpen, setDropdownOpen, onNavigateBack, onNavigate,
  openModalSafely, setModalStatusOpen, setModalVistoriaOpen,
  setModalParecerOpen, setModalSindicanciaOpen, setModalAcionamentoOpen,
  setModalExcluirOpen, setModalVincularOpen, setModalJuridicoOpen,
  setShowAtribuirFornecedores, handleWhatsApp,
}: SinistroDetalheHeaderProps) {
  const tipo = tipoConfig[sinistro.tipo] || tipoConfig.outro;
  const TipoIcon = tipo.icon;

  const isAprovadoCotaPagaTermoAssinado = sinistro.status === 'aprovado'
    && (sinistro as any).cota_paga === true
    && sinistro.termo_anuencia_assinado === true;
  const isAprovado = ['aprovado', 'em_regulacao', 'em_reparo', 'em_oficina', 'aguardando_peca', 'finalizado', 'pago', 'negado'].includes(sinistro.status);

  // Collect all badges
  const badges: { key: string; label: string; className: string; icon?: React.ReactNode }[] = [];
  
  if (sinistro.alerta_recem_ativado) {
    badges.push({ key: 'recem', label: 'Recém-ativado', className: 'bg-amber-50 text-amber-700 border-amber-300', icon: <AlertTriangle className="h-3 w-3 mr-1" /> });
  }
  if ((sinistro as any).alerta_inadimplente) {
    badges.push({ key: 'inadimpl', label: 'Pendência Financeira', className: 'bg-yellow-50 text-yellow-700 border-yellow-300', icon: <AlertTriangle className="h-3 w-3 mr-1" /> });
  }
  if ((sinistro as any).fluxo_simplificado) {
    badges.push({ key: 'fluxo', label: 'Fluxo Simplificado', className: 'bg-blue-50 text-blue-700 border-blue-300', icon: <Square className="h-3 w-3 mr-1" /> });
  }
  if (sinistro.analise_interna === true) {
    const isNat = sinistro.tipo === 'fenomeno_natural';
    badges.push({ key: 'analise', label: isNat ? 'Análise Jurídica' : 'Análise Interna', className: 'bg-orange-50 text-orange-700 border-orange-300', icon: isNat ? <CloudRain className="h-3 w-3 mr-1" /> : <Flame className="h-3 w-3 mr-1" /> });
  }
  if (sinistro.autentique_documento_id && !sinistro.termo_anuencia_assinado) {
    badges.push({ key: 'asspen', label: 'Assinatura Pendente', className: 'bg-amber-50 text-amber-700 border-amber-300', icon: <FileCheck className="h-3 w-3 mr-1" /> });
  }
  if (sinistro.tipo === 'colisao' && sinistro.necessita_reboque === true) {
    badges.push({ key: 'reboque', label: 'COM REBOQUE', className: 'bg-red-50 text-red-700 border-red-300' });
  }
  if (sinistro.tipo === 'colisao' && sinistro.necessita_reboque === false) {
    badges.push({ key: 'semreb', label: 'SEM REBOQUE', className: 'bg-green-50 text-green-700 border-green-300' });
  }
  if (sinistro.termo_anuencia_assinado) {
    badges.push({ key: 'termoass', label: 'Termo Assinado', className: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: <FileCheck className="h-3 w-3 mr-1" /> });
  }
  if (sinistro.termo_anuencia_assinado && !(sinistro as any).cota_paga) {
    badges.push({ key: 'cotapend', label: 'Pag. Cota Pendente', className: 'bg-orange-50 text-orange-700 border-orange-300', icon: <DollarSign className="h-3 w-3 mr-1" /> });
  }
  if ((sinistro as any).cota_paga) {
    badges.push({ key: 'cotapaga', label: 'Cota Paga', className: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: <DollarSign className="h-3 w-3 mr-1" /> });
  }

  return (
    <div className="space-y-4">
      {sinistro.status === 'aguardando_diretoria' && (
        <BannerAguardandoDiretoria sinistro={sinistro} />
      )}

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/dashboard">Home</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/eventos/sinistros">Sinistros</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{sinistro.protocolo}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header com gradiente baseado no tipo */}
      <div className={`rounded-xl border bg-gradient-to-r ${tipo.color} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={onNavigateBack} className="mt-1 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                  <TipoIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{sinistro.protocolo}</h1>
                  <p className="text-sm text-muted-foreground">
                    {tipo.label} • Aberto em {format(new Date(sinistro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge className={`${statusInfo.class} text-sm px-3 py-1 font-semibold`}>
                  {statusInfo.label}
                </Badge>
              </div>

              {/* Badges em linha */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-14">
                  {badges.map(b => (
                    <Badge key={b.key} variant="outline" className={`${b.className} text-xs px-2 py-0.5`}>
                      {b.icon}{b.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleWhatsApp(sinistro.associado?.whatsapp || sinistro.associado?.telefone)}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </Button>

            {(() => {
              if (isAprovadoCotaPagaTermoAssinado) {
                return (
                  <Button size="sm" onClick={() => setShowAtribuirFornecedores(true)}>
                    <Package className="h-4 w-4 mr-2" />
                    Fazer Pedidos
                  </Button>
                );
              }
              if (isAnalistaEventosOnly && isAprovado) return null;

              return (
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4 mr-1" />
                      Ações
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openModalSafely(setModalStatusOpen); }}>
                      <FileCheck className="h-4 w-4 mr-2" /> Atualizar Status
                    </DropdownMenuItem>
                    {sinistro.tipo !== 'vidros' && (
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openModalSafely(setModalVistoriaOpen); }}>
                        <Calendar className="h-4 w-4 mr-2" /> Agendar Vistoria
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openModalSafely(setModalParecerOpen); }}>
                      <FileText className="h-4 w-4 mr-2" /> Emitir Parecer
                    </DropdownMenuItem>
                    {['em_analise', 'aguardando_parecer', 'em_vistoria'].includes(sinistro.status) && (
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openModalSafely(setModalSindicanciaOpen); }}>
                        <Search className="h-4 w-4 mr-2" /> Encaminhar para Sindicância
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleWhatsApp(sinistro.associado?.whatsapp || sinistro.associado?.telefone)}>
                      <MessageCircle className="h-4 w-4 mr-2" /> Enviar WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {['roubo', 'furto'].includes(sinistro.tipo) && (
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => { e.preventDefault(); openModalSafely(setModalAcionamentoOpen); }}>
                        <Radio className="h-4 w-4 mr-2" /> Acionar Recuperação
                      </DropdownMenuItem>
                    )}
                    {['aprovado', 'em_regulacao', 'em_reparo'].includes(sinistro.status) && sinistro.tipo !== 'vidros' && (
                      <DropdownMenuItem onClick={() => onNavigate(`/oficina/ordens-servico?novo=true&sinistro_id=${sinistro.id}`)}>
                        <Wrench className="h-4 w-4 mr-2" /> Criar Ordem de Serviço
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openModalSafely(setModalJuridicoOpen); }}>
                      <Scale className="h-4 w-4 mr-2" /> Encaminhar para Jurídico
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onNavigate(`/juridico/processos/novo?sinistro_id=${sinistro.id}`)}>
                      <Scale className="h-4 w-4 mr-2" /> Criar Processo Jurídico
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openModalSafely(setModalVincularOpen); }}>
                      <LinkIcon className="h-4 w-4 mr-2" /> Vincular Processo
                    </DropdownMenuItem>
                    {isDiretor && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => { e.preventDefault(); openModalSafely(setModalExcluirOpen); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir Sinistro
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
