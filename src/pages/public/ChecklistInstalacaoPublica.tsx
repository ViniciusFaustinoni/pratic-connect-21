import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, XCircle, AlertTriangle, ClipboardCheck, 
  Camera, Video, ExternalLink, ShieldCheck, Loader2, 
  FileText, Play 
} from 'lucide-react';
import { VisualizadorFoto } from '@/components/analise/VisualizadorFoto';

interface ChecklistItemData {
  id: string;
  label: string;
  status: 'ok' | 'nok' | 'pendente';
  observacao?: string;
  fotos?: string[];
}

interface ServicoPublico {
  id: string;
  tipo: string;
  status: string;
  checklist_data: any;
  ressalvas_instalador: string | null;
  fotos_ressalva: string[] | null;
  video_360_url: string | null;
  laudo_autentique_url: string | null;
  laudo_assinado: boolean;
  laudo_assinado_em: string | null;
  quilometragem: number | null;
  associado: {
    nome: string;
  } | null;
  veiculo: {
    modelo: string;
    placa: string;
    marca: string;
    ano: number | null;
    cor: string | null;
  } | null;
  vistoriaFotos: Array<{
    arquivo_url: string;
    tipo: string;
    visivel_cliente: boolean;
  }>;
}

export default function ChecklistInstalacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [servico, setServico] = useState<ServicoPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visualizadorOpen, setVisualizadorOpen] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchServico();
  }, [token]);

  // Polling para detectar assinatura
  useEffect(() => {
    if (!servico || servico.laudo_assinado) return;
    const interval = setInterval(async () => {
      const { data } = await publicSupabase
        .from('servicos')
        .select('laudo_assinado, laudo_assinado_em')
        .eq('id', servico.id)
        .single();
      if (data?.laudo_assinado) {
        setServico(prev => prev ? { ...prev, laudo_assinado: true, laudo_assinado_em: data.laudo_assinado_em } : prev);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [servico?.id, servico?.laudo_assinado]);

  async function fetchServico() {
    try {
      setLoading(true);
      // Buscar contrato pelo link_token
      const { data: contrato, error: contratoErr } = await publicSupabase
        .from('contratos')
        .select('id, associado_id, veiculo_id')
        .eq('link_token', token)
        .maybeSingle();

      if (contratoErr || !contrato) {
        setError('Link inválido ou expirado.');
        return;
      }

      // Buscar serviço de instalação vinculado ao contrato
      const { data: servicoData, error: servicoErr } = await publicSupabase
        .from('servicos')
        .select(`
          id, tipo, status, checklist_data, ressalvas_instalador, 
          fotos_ressalva, video_360_url, laudo_autentique_url, 
          laudo_assinado, laudo_assinado_em, quilometragem
        `)
        .eq('contrato_id', contrato.id)
        .eq('tipo', 'instalacao')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (servicoErr || !servicoData) {
        setError('Instalação não encontrada.');
        return;
      }

      // Buscar dados do associado e veículo
      const [assocRes, veicRes] = await Promise.all([
        contrato.associado_id
          ? publicSupabase.from('associados').select('nome').eq('id', contrato.associado_id).single()
          : { data: null },
        contrato.veiculo_id
          ? publicSupabase.from('veiculos').select('modelo, placa, marca, ano, cor').eq('id', contrato.veiculo_id).single()
          : { data: null },
      ]);

      // Buscar fotos da vistoria (via vistorias do veículo)
      let vistoriaFotos: any[] = [];
      if (contrato.veiculo_id) {
        const { data: vistoria } = await publicSupabase
          .from('vistorias')
          .select('id')
          .eq('veiculo_id', contrato.veiculo_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (vistoria?.id) {
          const { data: fotos } = await publicSupabase
            .from('vistoria_fotos')
            .select('arquivo_url, tipo, visivel_cliente')
            .eq('vistoria_id', vistoria.id)
            .eq('visivel_cliente', true);
          vistoriaFotos = fotos || [];
        }
      }

      setServico({
        ...servicoData,
        laudo_assinado: servicoData.laudo_assinado ?? false,
        associado: assocRes.data,
        veiculo: veicRes.data,
        vistoriaFotos,
      });
    } catch (err) {
      setError('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  const checklistItems = useMemo<ChecklistItemData[]>(() => {
    if (!servico?.checklist_data) return [];
    const data = servico.checklist_data;
    // checklist_data pode ser { items: [...] } ou { itemId: { status, observacao, fotos } }
    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }
    // Formato objeto
    return Object.entries(data)
      .filter(([key]) => key !== 'items')
      .map(([id, val]: [string, any]) => ({
        id,
        label: val.label || id.replace(/_/g, ' '),
        status: val.status || 'pendente',
        observacao: val.observacao,
        fotos: val.fotos,
      }));
  }, [servico?.checklist_data]);

  // Fotos para galeria (excluindo tipo 'instalacao' e 'local_rastreador')
  const fotosGaleria = useMemo(() => {
    if (!servico) return [];
    const tiposExcluidos = ['instalacao', 'local_rastreador', 'assinatura_cliente'];
    return servico.vistoriaFotos
      .filter(f => !tiposExcluidos.includes(f.tipo))
      .map((f, i) => ({
        url: f.arquivo_url,
        label: formatTipoFoto(f.tipo),
        tipo: f.tipo,
      }));
  }, [servico?.vistoriaFotos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando checklist...</p>
        </div>
      </div>
    );
  }

  if (error || !servico) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">{error || 'Erro desconhecido'}</h2>
            <p className="text-sm text-muted-foreground">
              Se o problema persistir, entre em contato com a associação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itensOk = checklistItems.filter(i => i.status === 'ok').length;
  const itensNok = checklistItems.filter(i => i.status === 'nok').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardCheck className="h-7 w-7" />
            <h1 className="text-xl font-bold">Laudo de Instalação</h1>
          </div>
          {servico.associado && (
            <p className="text-primary-foreground/80 text-sm">
              Olá, {servico.associado.nome.split(' ')[0]}!
            </p>
          )}
          {servico.veiculo && (
            <p className="text-primary-foreground/70 text-xs mt-1">
              {servico.veiculo.marca} {servico.veiculo.modelo} - {servico.veiculo.placa}
              {servico.veiculo.cor ? ` | ${servico.veiculo.cor}` : ''}
              {servico.veiculo.ano ? ` | ${servico.veiculo.ano}` : ''}
            </p>
          )}
          {servico.quilometragem && (
            <p className="text-primary-foreground/70 text-xs mt-1">
              Quilometragem: {servico.quilometragem.toLocaleString('pt-BR')} km
            </p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-32">
        {/* Status da assinatura */}
        {servico.laudo_assinado && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-green-500" />
                <div>
                  <h3 className="font-semibold text-green-600">Laudo Assinado ✅</h3>
                  <p className="text-xs text-muted-foreground">
                    Assinado em {servico.laudo_assinado_em 
                      ? new Date(servico.laudo_assinado_em).toLocaleDateString('pt-BR', { 
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                        })
                      : ''}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seção 1: Checklist de Serviços */}
        {checklistItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Checklist de Serviços
                </span>
                <div className="flex gap-1.5">
                  {itensOk > 0 && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                      {itensOk} OK
                    </Badge>
                  )}
                  {itensNok > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
                      {itensNok} Ressalva
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  {item.status === 'ok' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  ) : item.status === 'nok' ? (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.observacao && (
                      <p className="text-xs text-muted-foreground mt-1">{item.observacao}</p>
                    )}
                    {item.fotos && item.fotos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {item.fotos.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Evidência ${i + 1}`}
                            className="h-12 w-12 rounded object-cover border border-border cursor-pointer"
                            onClick={() => {
                              // Simple image open
                              window.open(url, '_blank');
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Seção 2: Avarias Identificadas */}
        {(servico.ressalvas_instalador || (servico.fotos_ressalva && servico.fotos_ressalva.length > 0)) && (
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Avarias Identificadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {servico.ressalvas_instalador && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{servico.ressalvas_instalador}</p>
                </div>
              )}
              {servico.fotos_ressalva && servico.fotos_ressalva.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Fotos de evidência:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {servico.fotos_ressalva.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Avaria ${i + 1}`}
                        className="aspect-square rounded-lg object-cover border border-border cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Seção 3: Mídia Visual */}
        {(fotosGaleria.length > 0 || servico.video_360_url) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5 text-primary" />
                Registro Fotográfico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Fotos */}
              {fotosGaleria.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {fotosGaleria.map((foto, i) => (
                    <div
                      key={i}
                      className="relative aspect-square cursor-pointer group"
                      onClick={() => {
                        setFotoIndex(i);
                        setVisualizadorOpen(true);
                      }}
                    >
                      <img
                        src={foto.url}
                        alt={foto.label}
                        className="h-full w-full rounded-lg object-cover border border-border group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-lg px-1.5 py-1">
                        <p className="text-[10px] text-white truncate">{foto.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Vídeo 360° */}
              {servico.video_360_url && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-foreground">Vídeo 360°</span>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-xs">
                      <Play className="h-3 w-3 mr-1" />
                      360°
                    </Badge>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border">
                    <video
                      src={servico.video_360_url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full aspect-video object-contain bg-black"
                    >
                      Seu navegador não suporta vídeos.
                    </video>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info disclaimer */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground text-center">
            Ao assinar o laudo, você confirma que está ciente de todas as atividades 
            e condições registradas durante a instalação do rastreador.
          </p>
        </div>
      </div>

      {/* Botão fixo no rodapé */}
      {!servico.laudo_assinado && servico.laudo_autentique_url && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 shadow-lg">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={() => window.open(servico.laudo_autentique_url!, '_blank')}
            >
              <FileText className="h-5 w-5" />
              Assinar Laudo de Instalação
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Visualizador de fotos */}
      <VisualizadorFoto
        fotos={fotosGaleria}
        indexInicial={fotoIndex}
        open={visualizadorOpen}
        onClose={() => setVisualizadorOpen(false)}
      />
    </div>
  );
}

function formatTipoFoto(tipo: string): string {
  const map: Record<string, string> = {
    frente: 'Frente',
    traseira: 'Traseira',
    lateral_esquerda: 'Lateral Esquerda',
    lateral_direita: 'Lateral Direita',
    painel: 'Painel',
    motor: 'Motor',
    chassi: 'Chassi',
    placa: 'Placa',
    documento: 'Documento',
    hodometro: 'Hodômetro',
    interior: 'Interior',
    teto: 'Teto',
    capo: 'Capô',
    pneu: 'Pneu',
    video_360: 'Vídeo 360°',
  };
  return map[tipo] || tipo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
