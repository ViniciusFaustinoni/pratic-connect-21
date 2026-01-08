import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, Bike, Camera, ChevronDown, ChevronUp, Check, X, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAssociado } from '@/contexts/AssociadoContext';
import { FotoRevistoriaUpload } from '@/components/app/FotoRevistoriaUpload';
import { RevistoriaStatusCard, RevistoriaStatusType } from '@/components/app/RevistoriaStatusCard';
import { getFotosConfig, TipoVeiculoRevistoria, FOTOS_CARRO, FOTOS_MOTO } from '@/data/revistoriaConfig';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function Revistoria() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { associado, isTestMode } = useAssociado();
  
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculoRevistoria | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dicasOpen, setDicasOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Dados de revistoria do associado (mock)
  const revistoria = associado?.revistoria;
  
  // Determinar status para o card
  const getStatus = (): RevistoriaStatusType => {
    if (!revistoria) return 'ativa';
    
    if (revistoria.status === 'em_analise') return 'em_analise';
    if (revistoria.status === 'aprovada') return 'aprovada';
    if (revistoria.status === 'reprovada') return 'reprovada';
    
    if (revistoria.diasAtraso >= 6) return 'revistoria_obrigatoria';
    if (revistoria.diasAtraso >= 1) return 'suspensa_sem_revistoria';
    
    return 'ativa';
  };

  const status = getStatus();
  const fotosConfig = tipoVeiculo ? getFotosConfig(tipoVeiculo) : [];
  const totalFotos = fotosConfig.length;
  const fotosTiradas = Object.keys(fotos).length;
  const progresso = totalFotos > 0 ? (fotosTiradas / totalFotos) * 100 : 0;
  const todasFotosOk = fotosTiradas === totalFotos && totalFotos > 0;

  const handleCapture = (fotoId: string, base64: string) => {
    setFotos(prev => ({ ...prev, [fotoId]: base64 }));
  };

  const handleRemove = (fotoId: string) => {
    setFotos(prev => {
      const newFotos = { ...prev };
      delete newFotos[fotoId];
      return newFotos;
    });
  };

  const handleSubmit = async () => {
    if (!todasFotosOk) return;

    setIsSubmitting(true);
    
    // Simular envio
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: 'Revistoria enviada!',
      description: 'Aguarde a análise das suas fotos.',
    });

    setIsSubmitting(false);
  };

  const mostrarFormulario = status === 'revistoria_obrigatoria' || status === 'reprovada';
  const mostrarEducativo = status === 'ativa' || status === 'suspensa_sem_revistoria';

  // Estado para accordions
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Componente de seção educativa compacta
  const SecaoEducativa = ({ colapsado = false }: { colapsado?: boolean }) => {
    const items = [
      {
        id: 'oque',
        icon: '📋',
        title: 'O que é a Revistoria?',
        content: (
          <p className="text-sm text-muted-foreground">
            Atualização das fotos do seu veículo quando há atraso no pagamento superior a 5 dias, 
            para garantir que ele continua nas mesmas condições.
          </p>
        )
      },
      {
        id: 'quando',
        icon: '⚠️',
        title: 'Quando preciso fazer?',
        iconBg: 'bg-amber-100 dark:bg-amber-900',
        content: (
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Boleto vencido há mais de 5 dias</li>
            <li>• A partir do 6º dia, é obrigatória</li>
            <li>• Proteção reativada após fotos + pagamento</li>
          </ul>
        )
      },
      {
        id: 'como',
        icon: '📸',
        title: 'Como funciona?',
        iconBg: 'bg-blue-100 dark:bg-blue-900',
        content: (
          <div className="flex flex-wrap gap-2 text-xs">
            {['1. Selecionar tipo', '2. Tirar fotos', '3. Enviar', '4. Aguardar (24h)', '5. Pagar boleto', '6. Reativado!'].map((step, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-1">{step}</span>
            ))}
          </div>
        )
      },
      {
        id: 'fotos',
        icon: '📷',
        title: 'Fotos necessárias',
        content: (
          <Tabs defaultValue="carro" className="mt-1">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="carro" className="text-xs">Carro (11)</TabsTrigger>
              <TabsTrigger value="moto" className="text-xs">Moto (7)</TabsTrigger>
            </TabsList>
            <TabsContent value="carro" className="mt-2">
              <div className="grid grid-cols-2 gap-1 text-xs">
                {FOTOS_CARRO.map(f => (
                  <div key={f.id} className="flex items-center gap-1 text-muted-foreground">
                    <span className="font-bold text-purple-600">{f.ordem}.</span>
                    <span className="truncate">{f.label}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="moto" className="mt-2">
              <div className="grid grid-cols-2 gap-1 text-xs">
                {FOTOS_MOTO.map(f => (
                  <div key={f.id} className="flex items-center gap-1 text-muted-foreground">
                    <span className="font-bold text-purple-600">{f.ordem}.</span>
                    <span className="truncate">{f.label}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )
      },
      {
        id: 'dicas',
        icon: '💡',
        title: 'Dicas importantes',
        content: (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" /> Na hora
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" /> Boa luz
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" /> Veículo limpo
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" /> Placas visíveis
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <X className="h-3 w-3" /> Sem galeria
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <X className="h-3 w-3" /> Sem fotos antigas
            </div>
          </div>
        )
      }
    ];

    const accordionContent = (
      <div className="flex flex-col gap-2">
        {items.map(item => (
          <Collapsible key={item.id} open={openSections[item.id]} onOpenChange={() => toggleSection(item.id)}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm", item.iconBg || 'bg-muted')}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.title}</span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openSections[item.id] && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 py-2">
              {item.content}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );

    if (colapsado) {
      return (
        <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
          <CollapsibleTrigger asChild>
            <button className="mt-4 flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
              <span className="text-sm font-medium">📖 Saiba mais sobre revistoria</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", infoOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            {accordionContent}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return <div className="mt-2">{accordionContent}</div>;
  };

  return (
    <div className="flex flex-col gap-4 pb-32">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Revistoria</h1>
      </div>

      {/* STATUS CARD */}
      <RevistoriaStatusCard
        status={status}
        diasAtraso={revistoria?.diasAtraso ?? 0}
        dataEnvio={revistoria?.dataEnvio}
        motivosReprovacao={revistoria?.motivosReprovacao ?? []}
        dataLimite={revistoria?.dataLimiteRevistoria}
      />

      {/* CENÁRIO A: EM DIA - Mostrar seções educativas */}
      {status === 'ativa' && (
        <SecaoEducativa />
      )}

      {/* CENÁRIO B: SUSPENSO SEM REVISTORIA (1-5 dias) */}
      {status === 'suspensa_sem_revistoria' && (
        <>
          {/* Aviso que ainda não precisa de revistoria */}
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200">ℹ️ Ainda não precisa de revistoria</h3>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    Se você pagar o boleto nos próximos {5 - (revistoria?.diasAtraso || 0)} dia(s), sua proteção 
                    será reativada automaticamente sem necessidade de revistoria.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline visual */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Hoje (dia {revistoria?.diasAtraso})</span>
                <span>Dia 6 (revistoria)</span>
              </div>
              <Progress value={((revistoria?.diasAtraso || 0) / 6) * 100} className="h-3" />
              <p className="mt-2 text-center text-sm font-medium text-amber-700 dark:text-amber-400">
                Pague agora e evite a revistoria
              </p>
            </CardContent>
          </Card>

          {/* Seção educativa colapsada */}
          <SecaoEducativa colapsado />
        </>
      )}

      {/* CENÁRIO C & E: REVISTORIA OBRIGATÓRIA ou REPROVADA - Formulário de fotos */}
      {mostrarFormulario && (
        <>
          {/* SELEÇÃO DE TIPO DE VEÍCULO */}
          {!tipoVeiculo && (
            <div className="mt-2">
              <h2 className="text-lg font-semibold">Qual tipo de veículo?</h2>
              <p className="text-sm text-muted-foreground">
                Selecione para ver as fotos necessárias
              </p>

              <div className="mt-4 grid grid-cols-2 gap-4">
                {/* CARRO */}
                <button
                  onClick={() => setTipoVeiculo('carro')}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-6 transition-colors hover:border-blue-500 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:hover:border-blue-600"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800">
                    <Car className="h-10 w-10 text-blue-700 dark:text-blue-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">Carro</p>
                    <p className="text-sm text-muted-foreground">11 fotos necessárias</p>
                  </div>
                </button>

                {/* MOTO */}
                <button
                  onClick={() => setTipoVeiculo('moto')}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-purple-200 bg-purple-50 p-6 transition-colors hover:border-purple-500 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950 dark:hover:border-purple-600"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-200 dark:bg-purple-800">
                    <Bike className="h-10 w-10 text-purple-700 dark:text-purple-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">Moto</p>
                    <p className="text-sm text-muted-foreground">7 fotos necessárias</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* SEÇÃO DE FOTOS */}
          {tipoVeiculo && (
            <div className="mt-2 flex flex-col gap-4">
              {/* HEADER COM TIPO SELECIONADO */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Fotos Necessárias - {tipoVeiculo === 'carro' ? 'Carro' : 'Moto'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Tire as fotos na ordem indicada. Apenas câmera, sem galeria.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTipoVeiculo(null);
                    setFotos({});
                  }}
                >
                  Trocar
                </Button>
              </div>

              {/* AVISO IMPORTANTE */}
              <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                <CardContent className="flex items-center gap-3 p-3">
                  <Camera className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      📸 ATENÇÃO: As fotos devem ser tiradas AGORA
                    </p>
                    <p className="text-amber-700 dark:text-amber-300">
                      Não são aceitas fotos da galeria ou fotos antigas
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* BARRA DE PROGRESSO */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {fotosTiradas} de {totalFotos} fotos tiradas
                  </span>
                  <span className="font-medium text-primary">{Math.round(progresso)}%</span>
                </div>
                <Progress value={progresso} className="h-2" />
              </div>

              {/* DICAS */}
              <Collapsible open={dicasOpen} onOpenChange={setDicasOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
                    <span className="font-medium">📸 Dicas para aprovação</span>
                    {dicasOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Card>
                    <CardContent className="p-4 text-sm">
                      <ul className="space-y-1">
                        <li className="flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" /> Tire as fotos durante o dia, com boa luz
                        </li>
                        <li className="flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" /> O veículo deve estar limpo
                        </li>
                        <li className="flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" /> Todas as placas devem estar legíveis
                        </li>
                        <li className="flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" /> Não corte nenhuma parte do veículo
                        </li>
                        <li className="flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" /> Para o painel: LIGUE o veículo e acelere
                        </li>
                        <li className="flex items-center gap-2 text-red-600">
                          <X className="h-4 w-4" /> Não use fotos da galeria
                        </li>
                        <li className="flex items-center gap-2 text-red-600">
                          <X className="h-4 w-4" /> Não use fotos antigas
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {/* GRID DE FOTOS */}
              <div className="grid grid-cols-2 gap-3">
                {fotosConfig.map((config) => (
                  <FotoRevistoriaUpload
                    key={config.id}
                    config={config}
                    foto={fotos[config.id] || null}
                    onCapture={(base64) => handleCapture(config.id, base64)}
                    onRemove={() => handleRemove(config.id)}
                    totalFotos={totalFotos}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* HISTÓRICO */}
      {revistoria?.historico && revistoria.historico.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-3 text-lg font-semibold">📜 Histórico de Revistorias</h2>
          <div className="flex flex-col gap-2">
            {revistoria.historico.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {item.tipo === 'carro' ? (
                      <Car className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Bike className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {item.tipo === 'carro' ? 'Carro' : 'Moto'} - {item.fotos} fotos
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-medium',
                      item.status === 'aprovada'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    )}
                  >
                    {item.status === 'aprovada' ? 'Aprovada' : 'Reprovada'}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* BOTÃO FIXO DE ENVIO */}
      {mostrarFormulario && tipoVeiculo && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
          <Button
            onClick={handleSubmit}
            disabled={!todasFotosOk || isSubmitting}
            className={cn(
              'w-full py-6',
              todasFotosOk ? 'bg-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">
                {isSubmitting ? 'Enviando...' : 'Enviar Revistoria'}
              </span>
              <span className="text-xs opacity-80">
                {todasFotosOk
                  ? `Todas as ${totalFotos} fotos prontas ✓`
                  : `Faltam ${totalFotos - fotosTiradas} fotos`}
              </span>
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
