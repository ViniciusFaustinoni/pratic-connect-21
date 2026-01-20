import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ClipboardList, Loader2, CheckCircle2, Play, 
  Navigation, Phone, MessageSquare, Car, Clock,
  ChevronRight, Wrench, FileCheck
} from 'lucide-react';
import { useInstaladorInstalacoes, useIniciarInstalacao } from '@/hooks/useInstaladorInstalacoes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function InstaladorFila() {
  const navigate = useNavigate();
  const [data] = useState(new Date());
  
  const { data: instalacoes, isLoading, refetch } = useInstaladorInstalacoes(data);
  const iniciarMutation = useIniciarInstalacao();

  // Separar por status
  const { pendentes, emAndamento, concluidas } = useMemo(() => {
    if (!instalacoes) return { pendentes: [], emAndamento: [], concluidas: [] };
    
    return {
      pendentes: instalacoes.filter(i => ['agendada', 'em_rota'].includes(i.status)),
      emAndamento: instalacoes.filter(i => i.status === 'em_andamento'),
      concluidas: instalacoes.filter(i => i.status === 'concluida'),
    };
  }, [instalacoes]);

  const handleIniciar = (id: string, status: string, tipo: 'instalacao' | 'vistoria' = 'instalacao') => {
    if (tipo === 'vistoria') {
      navigate(`/instalador/vistoria/${id}`);
      return;
    }
    
    if (status === 'em_andamento') {
      navigate(`/instalador/instalacao/${id}`);
    } else {
      iniciarMutation.mutate(id, {
        onSuccess: () => {
          navigate(`/instalador/instalacao/${id}`);
        },
      });
    }
  };

  // Ações rápidas
  const abrirMapa = (endereco: string) => {
    const enderecoFormatado = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${enderecoFormatado}`, '_blank');
  };

  const ligar = (telefone: string) => {
    window.open(`tel:${telefone}`, '_self');
  };

  const abrirWhatsApp = (telefone: string, nomeCliente: string) => {
    const numero = telefone?.replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá ${nomeCliente}, sou o instalador da PRATIC. Estou a caminho para realizar o serviço.`
    );
    window.open(`https://wa.me/55${numero}?text=${mensagem}`, '_blank');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'agendada': 'bg-blue-500',
      'em_rota': 'bg-purple-500',
      'em_andamento': 'bg-orange-500',
      'concluida': 'bg-green-500',
      'cancelada': 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'agendada': 'Agendada',
      'em_rota': 'Em Rota',
      'em_andamento': 'Em Andamento',
      'concluida': 'Concluída',
      'cancelada': 'Cancelada',
    };
    return labels[status] || status;
  };

  const getEnderecoCompleto = (inst: typeof instalacoes extends (infer T)[] | undefined ? T : never) => {
    if (!inst) return '';
    const partes = [
      inst.logradouro,
      inst.numero,
      inst.bairro,
      inst.cidade,
      inst.uf
    ].filter(Boolean);
    return partes.join(', ');
  };

  const dataFormatada = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataCapitalized = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  const renderServicoCard = (inst: NonNullable<typeof instalacoes>[0], tipo: 'instalacao' | 'vistoria' = 'instalacao') => (
    <Card 
      key={inst.id}
      className="border-slate-700 bg-slate-800 hover:bg-slate-750 transition-colors"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {tipo === 'instalacao' ? (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20">
                <Wrench className="h-4 w-4 text-blue-400" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600/20">
                <FileCheck className="h-4 w-4 text-purple-400" />
              </div>
            )}
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                {tipo === 'instalacao' ? 'Instalação' : 'Vistoria'}
              </span>
              <Badge className={`ml-2 ${getStatusColor(inst.status)} text-white text-xs`}>
                {getStatusLabel(inst.status)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Clock className="h-3 w-3" />
            <span>{inst.periodo === 'manha' ? 'Manhã' : 'Tarde'}</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">
            {inst.associados?.nome || 'Cliente'}
          </h3>
          <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
            <Car className="h-3 w-3" />
            <span>
              {inst.veiculos?.marca} {inst.veiculos?.modelo} • {inst.veiculos?.placa}
            </span>
          </div>
        </div>

        {getEnderecoCompleto(inst) && (
          <div className="flex items-start gap-2 text-slate-300 text-xs">
            <Navigation className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{getEnderecoCompleto(inst)}</span>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 pt-1">
          <Button 
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={() => handleIniciar(inst.id, inst.status, tipo)}
            disabled={iniciarMutation.isPending}
          >
            <Play className="h-3 w-3 mr-1" />
            {inst.status === 'em_andamento' ? 'Continuar' : 'Iniciar'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-slate-600 text-slate-300 hover:bg-slate-700"
            onClick={() => {
              const endereco = getEnderecoCompleto(inst);
              if (endereco) abrirMapa(endereco);
            }}
            disabled={!getEnderecoCompleto(inst)}
          >
            <Navigation className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-slate-600 text-slate-300 hover:bg-slate-700"
            onClick={() => inst.associados?.telefone && ligar(inst.associados.telefone)}
            disabled={!inst.associados?.telefone}
          >
            <Phone className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-green-600 text-green-400 hover:bg-green-900/30"
            onClick={() => {
              const tel = inst.associados?.whatsapp || inst.associados?.telefone;
              if (tel) abrirWhatsApp(tel, inst.associados?.nome || 'Cliente');
            }}
            disabled={!inst.associados?.telefone && !inst.associados?.whatsapp}
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Carregando fila...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-400" />
              Fila de Serviços
            </h1>
            <p className="text-sm text-slate-400">{dataCapitalized}</p>
          </div>
          <Badge variant="outline" className="border-slate-600 text-slate-300">
            {instalacoes?.length || 0} serviços
          </Badge>
        </div>

        {/* Tabs por Status */}
        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="w-full bg-slate-800 border border-slate-700">
            <TabsTrigger value="pendentes" className="flex-1 data-[state=active]:bg-blue-600">
              Pendentes ({pendentes.length + emAndamento.length})
            </TabsTrigger>
            <TabsTrigger value="concluidas" className="flex-1 data-[state=active]:bg-green-600">
              Concluídas ({concluidas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-4 space-y-3">
            {emAndamento.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-orange-400 uppercase tracking-wide">
                  Em Andamento
                </h3>
                {emAndamento.map(inst => renderServicoCard(inst))}
              </div>
            )}
            
            {pendentes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Aguardando
                </h3>
                {pendentes.map(inst => renderServicoCard(inst))}
              </div>
            )}

            {pendentes.length === 0 && emAndamento.length === 0 && (
              <Card className="border-slate-700 bg-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <h3 className="mt-4 text-lg font-semibold text-white">Tudo certo!</h3>
                  <p className="mt-1 text-center text-sm text-slate-400">
                    Nenhum serviço pendente no momento.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="concluidas" className="mt-4 space-y-3">
            {concluidas.length > 0 ? (
              concluidas.map(inst => (
                <Card 
                  key={inst.id}
                  className="border-slate-700 bg-slate-800 cursor-pointer"
                  onClick={() => navigate(`/instalador/instalacao/${inst.id}`)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {inst.associados?.nome || 'Cliente'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {inst.veiculos?.placa} • {inst.periodo === 'manha' ? 'Manhã' : 'Tarde'}
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white text-xs">
                      Concluída
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-slate-700 bg-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-slate-600" />
                  <h3 className="mt-4 text-lg font-semibold text-white">Nenhuma conclusão</h3>
                  <p className="mt-1 text-center text-sm text-slate-400">
                    Você ainda não concluiu nenhum serviço hoje.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
