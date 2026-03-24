import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnaliseVistoria } from '@/hooks/useAnaliseVistoria';
import { VisualizadorFoto } from '@/components/analise/VisualizadorFoto';
import { Video360Card } from '@/components/cadastro/Video360Card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  User, 
  Car, 
  Camera, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ZoomIn,
  RefreshCw,
  Calendar,
  Loader2,
  Wifi,
  Radio,
  MapPin,
  Copy,
  ExternalLink,
  Video,
  ChevronDown
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CHECKLIST_ITEMS = [
  { id: 'foto_frente', label: 'Foto da frente está nítida e completa', categoria: 'fotos' },
  { id: 'foto_traseira', label: 'Foto da traseira está nítida e completa', categoria: 'fotos' },
  { id: 'foto_laterais', label: 'Fotos laterais mostram o veículo inteiro', categoria: 'fotos' },
  { id: 'foto_hodometro', label: 'Hodômetro está legível', categoria: 'fotos' },
  { id: 'foto_chassi', label: 'Chassi está legível e confere', categoria: 'fotos' },
  { id: 'placa_visivel', label: 'Placa visível e confere com cadastro', categoria: 'documentacao' },
  { id: 'modelo_confere', label: 'Veículo corresponde ao modelo cadastrado', categoria: 'documentacao' },
  { id: 'cor_confere', label: 'Cor do veículo confere', categoria: 'documentacao' },
  { id: 'sem_avarias_ocultas', label: 'Veículo não apresenta avarias não declaradas', categoria: 'condicoes' },
  { id: 'condicoes_ok', label: 'Veículo está em condições de receber proteção', categoria: 'condicoes' },
];

const MOTIVOS_REPROVACAO = [
  { value: 'fotos_ilegiveis', label: 'Fotos ilegíveis ou incompletas' },
  { value: 'chassi_nao_confere', label: 'Chassi não confere com cadastro' },
  { value: 'avarias_nao_declaradas', label: 'Avarias graves não declaradas' },
  { value: 'veiculo_mas_condicoes', label: 'Veículo em más condições' },
  { value: 'placa_adulterada', label: 'Indícios de adulteração na placa' },
  { value: 'documentacao_invalida', label: 'Documentação inválida' },
  { value: 'outro', label: 'Outro motivo' },
];

// Mapeamento de tipos de foto para labels legíveis
const FOTO_LABELS: Record<string, string> = {
  'frente': 'Frente',
  'traseira': 'Traseira',
  'lateral_esquerda': 'Lateral Esquerda',
  'lateral_direita': 'Lateral Direita',
  'hodometro': 'Hodômetro',
  'chassi': 'Chassi',
  'documento': 'Documento',
  'crlv_frente': 'CRLV Frente',
  'crlv_verso': 'CRLV Verso',
  'motor': 'Motor',
  'painel': 'Painel',
};

// Função para renderizar chassi com diferenças destacadas caractere por caractere
function renderChassiComparado(chassiCadastro: string, chassiOCR: string): { elemento: JSX.Element; diferencas: { posicao: number; esperado: string; encontrado: string }[] } {
  const cadastroNormalizado = chassiCadastro?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
  const ocrNormalizado = chassiOCR?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
  const maxLen = Math.max(cadastroNormalizado.length, ocrNormalizado.length);
  const caracteres: JSX.Element[] = [];
  const diferencas: { posicao: number; esperado: string; encontrado: string }[] = [];
  
  for (let i = 0; i < maxLen; i++) {
    const charCadastro = cadastroNormalizado[i] || '';
    const charOCR = ocrNormalizado[i] || '';
    const diferente = charCadastro !== charOCR;
    
    if (diferente) {
      diferencas.push({ posicao: i + 1, esperado: charCadastro || '—', encontrado: charOCR || '—' });
    }
    
    caracteres.push(
      <span 
        key={i} 
        className={diferente 
          ? 'bg-destructive/20 text-destructive font-bold px-0.5 rounded border border-destructive/30' 
          : ''
        }
        title={diferente ? `Posição ${i + 1}: esperado "${charCadastro}", encontrado "${charOCR}"` : undefined}
      >
        {charOCR || '?'}
      </span>
    );
  }
  
  return {
    elemento: <span className="font-mono text-sm tracking-wider">{caracteres}</span>,
    diferencas
  };
}

export default function AnaliseVistoria() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vistoria, isLoading, error, registrarDecisao, isRegistrando } = useAnaliseVistoria(id || '');

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [decisao, setDecisao] = useState<'aprovada' | 'aprovada_com_ressalvas' | 'reprovada' | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const [ressalvas, setRessalvas] = useState('');
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [detalheMotivo, setDetalheMotivo] = useState('');
  const [permitirNovaTentativa, setPermitirNovaTentativa] = useState(true);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [fotoVisualizador, setFotoVisualizador] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  
  // Estado para ativação do rastreador
  const [showAtivarRastreador, setShowAtivarRastreador] = useState(false);
  const [ativandoRastreador, setAtivandoRastreador] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !vistoria) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            Vistoria não encontrada ou erro ao carregar.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  // Preparar fotos para visualizador
  const fotos = vistoria.fotos
    .filter(f => f.arquivo_url)
    .map(f => ({
      url: f.arquivo_url,
      label: FOTO_LABELS[f.tipo] || f.tipo,
    }));

  const handleToggleChecklist = (itemId: string) => {
    setChecklist(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleConfirmar = () => {
    if (!decisao) return;
    setShowConfirmacao(true);
  };

  const handleSubmit = () => {
    registrarDecisao({
      vistoriaId: id!,
      decisao: decisao as 'aprovada' | 'aprovada_com_ressalvas' | 'reprovada',
      observacoes,
      ressalvas: decisao === 'aprovada_com_ressalvas' ? ressalvas : undefined,
      motivoReprovacao: decisao === 'reprovada' ? (motivoReprovacao === 'outro' ? detalheMotivo : motivoReprovacao) : undefined,
      permitirNovaTentativa: decisao === 'reprovada' ? permitirNovaTentativa : undefined,
    }, {
      onSuccess: () => {
        setShowConfirmacao(false);
        navigate('/cadastro/vistorias');
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'aguardando_analise': { label: 'Aguardando Análise', variant: 'secondary' },
      'pendente': { label: 'Pendente', variant: 'secondary' },
      'aprovada': { label: 'Aprovada', variant: 'default' },
      'reprovada': { label: 'Reprovada', variant: 'destructive' },
      'aprovada_com_ressalvas': { label: 'Aprovada c/ Ressalvas', variant: 'outline' },
    };
    return badges[status] || { label: status, variant: 'secondary' as const };
  };

  const statusBadge = getStatusBadge(vistoria.status);

  // Parsear avarias se for JSON string
  let avariasObj: Record<string, unknown> = {};
  if (vistoria.avarias) {
    try {
      avariasObj = typeof vistoria.avarias === 'string' 
        ? JSON.parse(vistoria.avarias) 
        : vistoria.avarias;
    } catch {
      avariasObj = { descricao: vistoria.avarias };
    }
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Análise de Vistoria</h1>
            <p className="text-muted-foreground">
              Protocolo: {vistoria.protocolo || vistoria.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Esquerda - Dados e Fotos */}
        <div className="space-y-6">
          {/* Card Localização da Vistoria */}
          {(vistoria as any).endereco_latitude && (vistoria as any).endereco_longitude && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  Localização da Vistoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Latitude</p>
                    <p className="font-mono font-medium">{(vistoria as any).endereco_latitude?.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Longitude</p>
                    <p className="font-mono font-medium">{(vistoria as any).endereco_longitude?.toFixed(6)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const coords = `${(vistoria as any).endereco_latitude},${(vistoria as any).endereco_longitude}`;
                      navigator.clipboard.writeText(coords);
                      toast.success('Coordenadas copiadas!');
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const lat = (vistoria as any).endereco_latitude;
                      const lng = (vistoria as any).endereco_longitude;
                      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver no Mapa
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card Validação do Chassi via IA - Com destaque de diferenças */}
          {(vistoria.chassi_validacao || vistoria.chassi_ocr) && (() => {
            const chassiCadastro = vistoria.veiculo?.chassi || '';
            const chassiOCR = vistoria.chassi_ocr || '';
            const comparacao = chassiCadastro && chassiOCR 
              ? renderChassiComparado(chassiCadastro, chassiOCR)
              : null;
            
            return (
              <Card className={`border ${
                vistoria.chassi_validacao === 'confere' 
                  ? 'border-emerald-500/30 bg-emerald-500/5' 
                  : vistoria.chassi_validacao === 'diverge'
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-yellow-500/30 bg-yellow-500/5'
              }`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {vistoria.chassi_validacao === 'confere' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : vistoria.chassi_validacao === 'diverge' ? (
                      <XCircle className="w-5 h-5 text-destructive" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    )}
                    Validação do Chassi (IA)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Chassi do CRLV (cadastro)</p>
                      <p className="font-mono font-medium text-sm tracking-wider">
                        {chassiCadastro || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Chassi da Foto (OCR)</p>
                      {/* Mostrar chassi com diferenças destacadas se houver divergência */}
                      {vistoria.chassi_validacao === 'diverge' && comparacao ? (
                        comparacao.elemento
                      ) : (
                        <p className="font-mono font-medium text-sm tracking-wider">
                          {chassiOCR || '—'}
                        </p>
                      )}
                    </div>
                    {vistoria.chassi_ocr_confianca !== null && (
                      <div>
                        <p className="text-sm text-muted-foreground">Confiança da leitura</p>
                        <p className="font-medium">{vistoria.chassi_ocr_confianca}%</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Detalhe das diferenças quando houver divergência */}
                  {vistoria.chassi_validacao === 'diverge' && comparacao && comparacao.diferencas.length > 0 && (
                    <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                      <p className="text-sm font-medium text-destructive mb-2">
                        {comparacao.diferencas.length === 1 
                          ? '1 caractere divergente:'
                          : `${comparacao.diferencas.length} caracteres divergentes:`
                        }
                      </p>
                      <ul className="text-sm space-y-1">
                        {comparacao.diferencas.slice(0, 5).map((dif, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            <span className="font-mono">Posição {dif.posicao}:</span>{' '}
                            esperado "<span className="font-bold text-foreground">{dif.esperado}</span>", 
                            encontrado "<span className="font-bold text-destructive">{dif.encontrado}</span>"
                          </li>
                        ))}
                        {comparacao.diferencas.length > 5 && (
                          <li className="text-muted-foreground italic">
                            ... e mais {comparacao.diferencas.length - 5} diferença(s)
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  {/* Badge de resultado */}
                  <div className={`p-3 rounded-lg ${
                    vistoria.chassi_validacao === 'confere' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30' 
                      : vistoria.chassi_validacao === 'diverge'
                      ? 'bg-destructive/10 border border-destructive/30'
                      : 'bg-yellow-500/10 border border-yellow-500/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      {vistoria.chassi_validacao === 'confere' ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                          <div>
                            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                              CHASSI CONFERE
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Os números são idênticos
                            </p>
                          </div>
                        </>
                      ) : vistoria.chassi_validacao === 'diverge' ? (
                        <>
                          <XCircle className="w-5 h-5 text-destructive" />
                          <div>
                            <p className="font-semibold text-destructive">
                              CHASSI DIVERGENTE
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {comparacao && comparacao.diferencas.length > 0
                                ? `${comparacao.diferencas.length} caractere(s) diferente(s). Verifique manualmente.`
                                : 'O número da foto não confere com o cadastro. Verifique manualmente.'
                              }
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          <div>
                            <p className="font-semibold text-yellow-700 dark:text-yellow-400">
                              CHASSI ILEGÍVEL
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Não foi possível ler o chassi na foto. Verifique manualmente.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Card Cliente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{vistoria.associado?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium">{vistoria.associado?.cpf || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{vistoria.associado?.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{vistoria.associado?.telefone || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Card Veículo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Car className="w-5 h-5" />
                Dados do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Veículo</p>
                <p className="font-medium">
                  {vistoria.veiculo ? `${vistoria.veiculo.marca} ${vistoria.veiculo.modelo}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ano</p>
                <p className="font-medium">{vistoria.veiculo?.ano_modelo || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Placa</p>
                <p className="font-medium font-mono">{vistoria.veiculo?.placa || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cor</p>
                <p className="font-medium">{vistoria.veiculo?.cor || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Chassi</p>
                <p className="font-medium font-mono text-sm">{vistoria.veiculo?.chassi || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor FIPE</p>
                <p className="font-medium text-primary">
                  {vistoria.veiculo?.valor_fipe 
                    ? `R$ ${vistoria.veiculo.valor_fipe.toLocaleString('pt-BR')}`
                    : '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card IMEI do Rastreador (se informado) */}
          {(vistoria as any)?.imei_rastreador && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Radio className="w-5 h-5 text-blue-500" />
                  IMEI do Rastreador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">IMEI informado pelo vistoriador</p>
                    <p className="text-2xl font-mono font-bold tracking-wider">{(vistoria as any).imei_rastreador}</p>
                  </div>
                  <Wifi className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card Informações da Vistoria */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Informações da Vistoria
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium capitalize">{vistoria.tipo?.replace('_', ' ') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium">
                  {format(new Date(vistoria.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vistoriador</p>
                <p className="font-medium">{vistoria.vistoriador?.nome || 'Auto Vistoria'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hodômetro</p>
                <p className="font-medium">
                  {vistoria.km_atual ? `${vistoria.km_atual.toLocaleString('pt-BR')} km` : '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card Fotos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Fotos do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {fotos.map((foto, index) => (
                    <button
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all group"
                      onClick={() => setFotoVisualizador({ open: true, index })}
                    >
                      <img
                        src={foto.url}
                        alt={foto.label}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center truncate">
                        {foto.label}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhuma foto disponível</p>
              )}
            </CardContent>
          </Card>

          {/* Card Avarias */}
          {Object.keys(avariasObj).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Avarias Registradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(avariasObj).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2 text-sm">
                      <span className="font-medium capitalize">{key}:</span>
                      <span className="text-muted-foreground">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna Direita - Análise */}
        <div className="space-y-6">
          {/* Checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Checklist de Análise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fotos */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">FOTOS</p>
                <div className="space-y-2">
                  {CHECKLIST_ITEMS.filter(i => i.categoria === 'fotos').map(item => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={checklist[item.id] || false}
                        onCheckedChange={() => handleToggleChecklist(item.id)}
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Documentação */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">DOCUMENTAÇÃO</p>
                <div className="space-y-2">
                  {CHECKLIST_ITEMS.filter(i => i.categoria === 'documentacao').map(item => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={checklist[item.id] || false}
                        onCheckedChange={() => handleToggleChecklist(item.id)}
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Condições */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">CONDIÇÕES</p>
                <div className="space-y-2">
                  {CHECKLIST_ITEMS.filter(i => i.categoria === 'condicoes').map(item => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={checklist[item.id] || false}
                        onCheckedChange={() => handleToggleChecklist(item.id)}
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parecer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Parecer</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Observações gerais sobre a vistoria (opcional)..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Decisão */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Decisão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={decisao} onValueChange={(v) => setDecisao(v as typeof decisao)}>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors">
                  <RadioGroupItem value="aprovada" />
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Aprovar</p>
                    <p className="text-sm text-muted-foreground">Vistoria OK, liberar instalação</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-colors">
                  <RadioGroupItem value="aprovada_com_ressalvas" />
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">Aprovar com Ressalvas</p>
                    <p className="text-sm text-muted-foreground">OK, mas com observações importantes</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                  <RadioGroupItem value="reprovada" />
                  <XCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium">Reprovar</p>
                    <p className="text-sm text-muted-foreground">Problemas encontrados</p>
                  </div>
                </label>
              </RadioGroup>

              {/* Campo de ressalvas (se aprovada com ressalvas) */}
              {decisao === 'aprovada_com_ressalvas' && (
                <div className="mt-4">
                  <Label>Ressalvas *</Label>
                  <Textarea
                    placeholder="Descreva as ressalvas (ex: amassado no para-choque não coberto)..."
                    value={ressalvas}
                    onChange={(e) => setRessalvas(e.target.value)}
                    rows={2}
                    className="mt-2"
                  />
                </div>
              )}

              {/* Campos de reprovação */}
              {decisao === 'reprovada' && (
                <div className="mt-4 space-y-4">
                  <div>
                    <Label>Motivo da Reprovação *</Label>
                    <Select value={motivoReprovacao} onValueChange={setMotivoReprovacao}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Selecione o motivo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_REPROVACAO.map(motivo => (
                          <SelectItem key={motivo.value} value={motivo.value}>
                            {motivo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {motivoReprovacao === 'outro' && (
                    <div>
                      <Label>Detalhe o motivo *</Label>
                      <Textarea
                        placeholder="Descreva o motivo da reprovação..."
                        value={detalheMotivo}
                        onChange={(e) => setDetalheMotivo(e.target.value)}
                        rows={2}
                        className="mt-2"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox 
                      checked={permitirNovaTentativa}
                      onCheckedChange={(checked) => setPermitirNovaTentativa(!!checked)}
                    />
                    <span className="text-sm">Permitir nova tentativa (auto vistoria)</span>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botão Confirmar */}
          <Button 
            className="w-full h-12 text-lg"
            onClick={handleConfirmar}
            disabled={
              !decisao || 
              (decisao === 'aprovada_com_ressalvas' && !ressalvas) ||
              (decisao === 'reprovada' && !motivoReprovacao) ||
              (decisao === 'reprovada' && motivoReprovacao === 'outro' && !detalheMotivo)
            }
          >
            Confirmar Análise
          </Button>
        </div>
      </div>

      {/* Visualizador de Fotos */}
      <VisualizadorFoto
        fotos={fotos}
        indexInicial={fotoVisualizador.index}
        open={fotoVisualizador.open}
        onClose={() => setFotoVisualizador({ open: false, index: 0 })}
      />

      {/* Modal de Confirmação */}
      <Dialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisao === 'reprovada' ? 'Confirmar Reprovação' : 'Confirmar Aprovação'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {decisao === 'aprovada' && (
              <>
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium">Vistoria será APROVADA</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Próximos passos automáticos:</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Instalação será criada e entrará na fila</li>
                  <li>• Cliente será notificado por WhatsApp</li>
                  <li>• Coordenador poderá agendar instalação</li>
                </ul>
              </>
            )}

            {decisao === 'aprovada_com_ressalvas' && (
              <>
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg mb-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-600" />
                  <div>
                    <p className="font-medium">Vistoria será APROVADA COM RESSALVAS</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Ressalvas registradas:</p>
                <p className="text-sm bg-muted p-3 rounded">{ressalvas}</p>
              </>
            )}

            {decisao === 'reprovada' && (
              <>
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="font-medium">Vistoria será REPROVADA</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Motivo:</p>
                <p className="text-sm bg-muted p-3 rounded">
                  {motivoReprovacao === 'outro' 
                    ? detalheMotivo 
                    : MOTIVOS_REPROVACAO.find(m => m.value === motivoReprovacao)?.label}
                </p>
                {permitirNovaTentativa && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      O cliente poderá tentar uma nova auto vistoria.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmacao(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isRegistrando}
              variant={decisao === 'reprovada' ? 'destructive' : 'default'}
            >
              {isRegistrando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
