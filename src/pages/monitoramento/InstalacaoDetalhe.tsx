import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInstalacao, useInstalacaoActions } from '@/hooks/useInstalacoes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, Car, MapPin, Wrench, Phone, MessageSquare, Navigation, Calendar, Clock, Wifi, Play, CheckCircle, XCircle, RefreshCw, AlertCircle, ExternalLink, Loader2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS, PERIODO_LABELS } from '@/types/database';
import type { PeriodoInstalacao } from '@/types/database';
import { AtribuirInstaladorDialog } from '@/components/instalacoes/AtribuirInstaladorDialog';

const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
const formatPhone = (p: string | null | undefined) => {
  if (!p) return '—';
  const d = p.replace(/\D/g, '');
  return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : p;
};

export default function InstalacaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [reagendarOpen, setReagendarOpen] = useState(false);
  const [concluirOpen, setConcluirOpen] = useState(false);
  const [atribuirDialogOpen, setAtribuirDialogOpen] = useState(false);

  // Form reagendar
  const [novaData, setNovaData] = useState('');
  const [novoPeriodo, setNovoPeriodo] = useState<PeriodoInstalacao>('manha');
  const [motivoReagendamento, setMotivoReagendamento] = useState('');

  // Form concluir
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [obsConclusao, setObsConclusao] = useState('');

  const { data: instalacao, isLoading, error } = useInstalacao(id);
  const {
    iniciarRota, iniciarInstalacao, concluirInstalacao, reagendarInstalacao, cancelarInstalacao,
    isIniciandoRota, isIniciando, isConcluindo, isReagendando, isCancelando
  } = useInstalacaoActions();

  const handleWhatsApp = (phone: string | null | undefined) => {
    if (!phone) return;
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleLigar = (phone: string | null | undefined) => {
    if (!phone) return;
    window.open(`tel:${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleMapa = () => {
    if (!instalacao) return;
    const end = `${instalacao.logradouro}, ${instalacao.numero} - ${instalacao.bairro}, ${instalacao.cidade} - ${instalacao.uf}`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end)}`, '_blank');
  };

  const handleIniciarRota = () => { if (id) iniciarRota(id); };
  const handleIniciarInstalacao = () => { if (id) iniciarInstalacao(id); };

  const handleConcluir = () => {
    if (!id || !instalacao?.rastreador_id) return;
    
    // Concatenar hora início/fim nas observações
    const obsCompleta = horaInicio && horaFim 
      ? `Realizada das ${horaInicio} às ${horaFim}. ${obsConclusao || ''}`.trim()
      : obsConclusao || undefined;

    concluirInstalacao({
      instalacao_id: id,
      rastreador_id: instalacao.rastreador_id,
      observacoes: obsCompleta,
    });
    setConcluirOpen(false);
  };

  const handleReagendar = () => {
    if (!id || !novaData || !motivoReagendamento) return;
    reagendarInstalacao({
      instalacao_id: id,
      nova_data: novaData,
      novo_periodo: novoPeriodo,
      motivo: motivoReagendamento,
    });
    setReagendarOpen(false);
  };

  const handleCancelar = () => {
    if (!id) return;
    cancelarInstalacao({ id, motivo: 'Cancelada pelo administrador' });
    setCancelarOpen(false);
    navigate('/monitoramento/instalacoes');
  };

  // LOADING
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // ERROR
  if (error || !instalacao) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Instalação não encontrada</p>
        <Button variant="outline" onClick={() => navigate('/monitoramento/instalacoes')}>
          Voltar
        </Button>
      </div>
    );
  }

  const podeIniciarRota = instalacao.status === 'agendada' && instalacao.instalador_id;
  const podeIniciar = instalacao.status === 'em_rota';
  const podeConcluir = instalacao.status === 'em_andamento' && instalacao.rastreador_id;
  const podeReagendar = ['agendada', 'reagendada'].includes(instalacao.status);
  const podeCancelar = !['concluida', 'cancelada'].includes(instalacao.status);

  return (
    <div className="p-6 space-y-6">
      {/* BREADCRUMB */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to="/monitoramento/instalacoes" className="hover:text-foreground">Monitoramento</Link>
          <span>/</span>
          <Link to="/monitoramento/instalacoes" className="hover:text-foreground">Instalações</Link>
          <span>/</span>
          <span className="text-foreground">#{id?.slice(0, 8)}</span>
        </div>
      </nav>

      <Button variant="ghost" size="sm" onClick={() => navigate('/monitoramento/instalacoes')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Instalação #{id?.slice(0, 8)}</h1>
            <Badge className={cn("text-white", STATUS_INSTALACAO_COLORS[instalacao.status])}>
              {STATUS_INSTALACAO_LABELS[instalacao.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {formatDate(instalacao.data_agendada)} • {PERIODO_LABELS[instalacao.periodo]}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {podeIniciarRota && (
            <Button onClick={handleIniciarRota} disabled={isIniciandoRota}>
              {isIniciandoRota ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
              Iniciar Rota
            </Button>
          )}
          {podeIniciar && (
            <Button onClick={handleIniciarInstalacao} disabled={isIniciando}>
              {isIniciando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Iniciar Instalação
            </Button>
          )}
          {podeConcluir && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setConcluirOpen(true)}>
              <CheckCircle className="mr-2 h-4 w-4" /> Concluir
            </Button>
          )}
          {podeReagendar && (
            <Button variant="outline" onClick={() => setReagendarOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reagendar
            </Button>
          )}
          {podeCancelar && (
            <Button variant="destructive" onClick={() => setCancelarOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* GRID 2x2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* CLIENTE */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">{instalacao.associados?.nome || '—'}</p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{formatPhone(instalacao.associados?.telefone)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="outline" onClick={() => handleLigar(instalacao.associados?.telefone)}>
                  <Phone className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => handleWhatsApp(instalacao.associados?.telefone)}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* VEÍCULO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4" /> Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Marca / Modelo / Ano</p>
              <p className="font-medium">{instalacao.veiculos?.marca} {instalacao.veiculos?.modelo} {instalacao.veiculos?.ano_modelo}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Placa</p>
                <p className="font-medium">{instalacao.veiculos?.placa || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cor</p>
                <p className="font-medium">{instalacao.veiculos?.cor || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ENDEREÇO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="font-medium">{instalacao.logradouro}, {instalacao.numero}</p>
              {instalacao.complemento && <p className="text-sm text-muted-foreground">{instalacao.complemento}</p>}
              <p className="text-sm text-muted-foreground">{instalacao.bairro}</p>
              <p className="text-sm text-muted-foreground">{instalacao.cidade} - {instalacao.uf}</p>
              <p className="text-sm text-muted-foreground">CEP: {instalacao.cep}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleMapa}>
              <ExternalLink className="mr-2 h-4 w-4" /> Ver no Mapa
            </Button>
          </CardContent>
        </Card>

        {/* INSTALADOR */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" /> Instalador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {instalacao.profiles ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{instalacao.profiles.nome}</p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{formatPhone(instalacao.profiles.telefone)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" onClick={() => handleLigar(instalacao.profiles?.telefone)}>
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => handleWhatsApp(instalacao.profiles?.telefone)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-muted-foreground">Não atribuído</p>
                <Button variant="outline" onClick={() => setAtribuirDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" /> Atribuir Instalador
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RASTREADOR */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="h-4 w-4" /> Rastreador
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instalacao.rastreadores ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Código</p>
                <p className="font-medium">{instalacao.rastreadores.codigo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modelo</p>
                <p className="font-medium">{instalacao.rastreadores.modelo || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IMEI</p>
                <p className="font-medium">{instalacao.rastreadores.imei || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="secondary">Reservado</Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-1">
              <p className="text-muted-foreground">Nenhum rastreador reservado</p>
              <p className="text-sm text-muted-foreground">Atribua um instalador para reservar um rastreador</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OBSERVAÇÕES */}
      {instalacao.observacoes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{instalacao.observacoes}</p>
          </CardContent>
        </Card>
      )}

      {/* DIALOG CONCLUIR */}
      <Dialog open={concluirOpen} onOpenChange={setConcluirOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Instalação</DialogTitle>
            <DialogDescription>Informe os dados da conclusão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hora Início</Label>
                <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div>
                <Label>Hora Fim</Label>
                <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={obsConclusao} onChange={(e) => setObsConclusao(e.target.value)} placeholder="Ex: Instalado no painel..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcluirOpen(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleConcluir} disabled={!horaInicio || !horaFim || isConcluindo}>
              {isConcluindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG REAGENDAR */}
      <Dialog open={reagendarOpen} onOpenChange={setReagendarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar Instalação</DialogTitle>
            <DialogDescription>Informe a nova data e motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nova Data</Label>
                <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              </div>
              <div>
                <Label>Período</Label>
                <Select value={novoPeriodo} onValueChange={(v) => setNovoPeriodo(v as PeriodoInstalacao)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã (08h-12h)</SelectItem>
                    <SelectItem value="tarde">Tarde (13h-17h)</SelectItem>
                    <SelectItem value="noite">Noite (18h-21h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Motivo *</Label>
              <Textarea value={motivoReagendamento} onChange={(e) => setMotivoReagendamento(e.target.value)} placeholder="Ex: Cliente não estava em casa..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReagendarOpen(false)}>Cancelar</Button>
            <Button onClick={handleReagendar} disabled={!novaData || !motivoReagendamento || isReagendando}>
              {isReagendando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CANCELAR */}
      <AlertDialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Instalação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelar} disabled={isCancelando} className="bg-destructive hover:bg-destructive/90">
              {isCancelando ? 'Cancelando...' : 'Sim, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AtribuirInstaladorDialog
        instalacaoId={id || null}
        open={atribuirDialogOpen}
        onOpenChange={setAtribuirDialogOpen}
      />
    </div>
  );
}
