import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Puzzle, 
  RefreshCw, 
  Wrench, 
  ClipboardCheck, 
  MapPin, 
  Calendar, 
  Clock, 
  Car,
  User,
  Phone,
  Navigation,
  UserPlus,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTodosEncaixes, useAtribuirEncaixe, useConfiguracoesEncaixe, useAtualizarConfiguracoesEncaixe, type EncaixeDisponivel } from '@/hooks/useEncaixesDisponiveis';
import { useInstaladores } from '@/hooks/useInstaladores';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function EncaixeCardCoordenador({ encaixe }: { encaixe: EncaixeDisponivel }) {
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<string>('');
  const { data: instaladores, isLoading: loadingInstaladores } = useInstaladores();
  const { mutateAsync: atribuirEncaixe, isPending } = useAtribuirEncaixe();

  const handleAtribuir = async () => {
    if (!profissionalSelecionado) {
      toast.error('Selecione um profissional');
      return;
    }
    
    await atribuirEncaixe({
      id: encaixe.id,
      tipo: encaixe.tipo,
      profissionalId: profissionalSelecionado,
    });
    setProfissionalSelecionado('');
  };

  const handleNavegar = () => {
    if (encaixe.latitude && encaixe.longitude) {
      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encaixe.latitude},${encaixe.longitude}`;
    } else {
      const endereco = formatarEndereco();
      if (endereco) {
        window.location.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
      }
    }
  };

  const formatarEndereco = () => {
    const partes = [
      encaixe.endereco_logradouro,
      encaixe.endereco_numero,
      encaixe.endereco_bairro,
      encaixe.endereco_cidade,
    ].filter(Boolean);
    return partes.join(', ');
  };

  const getTipoLabel = () => {
    if (encaixe.tipo === 'instalacao') {
      return 'Instalação';
    }
    if (encaixe.tipo_vistoria === 'completa') {
      return 'Vistoria Completa';
    }
    if (encaixe.tipo_vistoria === 'cautelar') {
      return 'Vistoria Cautelar';
    }
    return 'Vistoria';
  };

  const dataFormatada = format(new Date(encaixe.data_agendada + 'T12:00:00'), "dd/MM", { locale: ptBR });
  const diaSemana = format(new Date(encaixe.data_agendada + 'T12:00:00'), "EEEE", { locale: ptBR });

  const jaTemProfissional = !!encaixe.profissional_atribuido_id;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header com tipo e data */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {encaixe.tipo === 'instalacao' ? (
              <div className="p-1.5 rounded-md bg-primary/10">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
            ) : (
              <div className="p-1.5 rounded-md bg-secondary">
                <ClipboardCheck className="h-4 w-4 text-secondary-foreground" />
              </div>
            )}
            <Badge variant={encaixe.tipo === 'instalacao' ? 'default' : 'secondary'}>
              {getTipoLabel()}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="capitalize">{diaSemana}, {dataFormatada}</span>
            {encaixe.periodo && (
              <>
                <Clock className="h-4 w-4 ml-2" />
                <span className="capitalize">{encaixe.periodo}</span>
              </>
            )}
          </div>
        </div>

        {/* Badge de profissional atribuído */}
        {jaTemProfissional && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
              <UserCheck className="h-3 w-3 mr-1" />
              Atribuído: {encaixe.profissional_atribuido_nome}
            </Badge>
          </div>
        )}

        {/* Cliente */}
        <div className="flex items-start gap-3">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">{encaixe.cliente_nome}</p>
            {encaixe.cliente_telefone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {encaixe.cliente_telefone}
              </p>
            )}
          </div>
        </div>

        {/* Veículo */}
        {encaixe.placa && (
          <div className="flex items-center gap-3">
            <Car className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="font-mono font-medium">{encaixe.placa}</span>
              {encaixe.marca && encaixe.modelo && (
                <span className="text-sm text-muted-foreground ml-2">
                  {encaixe.marca} {encaixe.modelo}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Endereço */}
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-sm">{formatarEndereco() || 'Endereço não informado'}</p>
        </div>

        {/* Seleção de profissional e ações */}
        <div className="flex flex-col gap-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <Select
              value={profissionalSelecionado}
              onValueChange={setProfissionalSelecionado}
              disabled={loadingInstaladores}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={jaTemProfissional ? "Selecionar novo profissional..." : "Selecionar profissional..."} />
              </SelectTrigger>
              <SelectContent>
                {instaladores?.map((instalador) => (
                  <SelectItem key={instalador.id} value={instalador.id}>
                    {instalador.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleNavegar}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Ver Mapa
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleAtribuir}
              disabled={!profissionalSelecionado || isPending}
            >
              {isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {jaTemProfissional ? 'Reatribuir' : 'Atribuir'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfiguracoesEncaixeSection() {
  const { data: config, isLoading } = useConfiguracoesEncaixe();
  const { mutateAsync: atualizarConfig, isPending } = useAtualizarConfiguracoesEncaixe();
  const [raioKm, setRaioKm] = useState<string>('');
  const [janelaHoras, setJanelaHoras] = useState<string>('');

  // Sincronizar valores quando config carregar
  useState(() => {
    if (config) {
      setRaioKm(String(config.raioKm));
      setJanelaHoras(String(config.janelaHoras));
    }
  });

  const handleSalvarRaio = async () => {
    const valor = Number(raioKm);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Digite um valor válido para o raio');
      return;
    }
    await atualizarConfig({ chave: 'operacional_encaixe_raio_km', valor: String(valor) });
  };

  const handleSalvarJanela = async () => {
    const valor = Number(janelaHoras);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Digite um valor válido para a janela');
      return;
    }
    await atualizarConfig({ chave: 'operacional_encaixe_janela_horas', valor: String(valor) });
  };

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configurações de Encaixe</CardTitle>
        <CardDescription>
          Defina os parâmetros para o sistema de encaixe de horários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Raio máximo (km)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={raioKm || config?.raioKm || ''}
                onChange={(e) => setRaioKm(e.target.value)}
                placeholder="10"
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={handleSalvarRaio}
                disabled={isPending}
              >
                Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Distância máxima para exibir encaixes aos profissionais
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Janela de disponibilidade (horas)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={janelaHoras || config?.janelaHoras || ''}
                onChange={(e) => setJanelaHoras(e.target.value)}
                placeholder="2"
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={handleSalvarJanela}
                disabled={isPending}
              >
                Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo mínimo livre que o profissional precisa ter para ver encaixes
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonitoramentoEncaixes({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const { data: encaixes, isLoading } = useTodosEncaixes();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['todos-encaixes'] });
  };

  const instalacoes = encaixes?.filter(e => e.tipo === 'instalacao') || [];
  const vistorias = encaixes?.filter(e => e.tipo === 'vistoria') || [];
  const comAtribuicao = encaixes?.filter(e => e.profissional_atribuido_id) || [];
  const semAtribuicao = encaixes?.filter(e => !e.profissional_atribuido_id) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Puzzle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Encaixes Disponíveis</h1>
            <p className="text-muted-foreground">
              Gerencie e atribua serviços marcados para encaixe
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Configurações */}
      <ConfiguracoesEncaixeSection />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{encaixes?.length || 0}</p>
              </div>
              <Puzzle className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sem Atribuição</p>
                <p className="text-2xl font-bold text-destructive">{semAtribuicao.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Instalações</p>
                <p className="text-2xl font-bold">{instalacoes.length}</p>
              </div>
              <Wrench className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vistorias</p>
                <p className="text-2xl font-bold">{vistorias.length}</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Encaixes */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : encaixes && encaixes.length > 0 ? (
        <div className="space-y-6">
          {/* Encaixes SEM atribuição primeiro */}
          {semAtribuicao.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Sem Profissional Atribuído ({semAtribuicao.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {semAtribuicao.map((encaixe) => (
                  <EncaixeCardCoordenador key={encaixe.id} encaixe={encaixe} />
                ))}
              </div>
            </div>
          )}

          {/* Encaixes COM atribuição (para reatribuição) */}
          {comAtribuicao.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-amber-600" />
                Com Profissional Atribuído ({comAtribuicao.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Estes encaixes já possuem profissional, mas você pode reatribuí-los se necessário.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {comAtribuicao.map((encaixe) => (
                  <EncaixeCardCoordenador key={encaixe.id} encaixe={encaixe} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nenhum encaixe disponível</AlertTitle>
          <AlertDescription>
            Não há serviços marcados para encaixe no momento. Os serviços aparecem aqui 
            quando são marcados com "Permite Encaixe".
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}