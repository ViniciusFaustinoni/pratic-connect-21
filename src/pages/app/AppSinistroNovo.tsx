import { useState, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  X,
  AlertTriangle,
  AlertCircle,
  Car,
  UserX,
  EyeOff,
  Flame,
  CloudRain,
  Users,
  Square,
  HelpCircle,
  MapPin,
  Navigation,
  Loader2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Camera,
  Plus,
  ClipboardCheck,
  Pencil,
  Send,
  LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppBottomNav } from '@/components/app/AppBottomNav';

// Tipos de sinistro
interface TipoSinistro {
  id: string;
  nome: string;
  descricao: string;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}

const tiposSinistro: TipoSinistro[] = [
  { id: 'colisao', nome: 'Colisão', descricao: 'Batida, abalroamento', icon: Car, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
  { id: 'roubo', nome: 'Roubo', descricao: 'Com ameaça/violência', icon: UserX, bgColor: 'bg-red-100', iconColor: 'text-red-600' },
  { id: 'furto', nome: 'Furto', descricao: 'Sem ameaça/violência', icon: EyeOff, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  { id: 'incendio', nome: 'Incêndio', descricao: 'Fogo no veículo', icon: Flame, bgColor: 'bg-red-100', iconColor: 'text-red-600' },
  { id: 'fenomeno_natural', nome: 'Fenômeno Natural', descricao: 'Enchente, granizo, raio', icon: CloudRain, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  { id: 'terceiros', nome: 'Danos a Terceiros', descricao: 'Você causou danos', icon: Users, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' },
  { id: 'vidros', nome: 'Vidros', descricao: 'Parabrisa, vidros laterais', icon: Square, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' },
  { id: 'outro', nome: 'Outro', descricao: 'Outro tipo de sinistro', icon: HelpCircle, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' },
];

const UFs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const fotosSugeridas = ['Frente', 'Traseira', 'Lateral E', 'Lateral D', 'Danos', 'Placa', 'Local'];

// Mock do veículo do associado
const veiculoMock = {
  modelo: 'Gol G5 1.0',
  placa: 'ABC-1234',
  cor: 'Prata',
};

interface FotoItem {
  file: File;
  preview: string;
}

export default function AppSinistroNovo() {
  const navigate = useNavigate();

  // Navegação do wizard
  const [etapa, setEtapa] = useState(1);
  const [showSairModal, setShowSairModal] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [protocoloGerado] = useState('SIN-2024-0001');

  // Etapa 1: Tipo
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);

  // Etapa 2: Data/Local
  const [dataOcorrencia, setDataOcorrencia] = useState('');
  const [horaOcorrencia, setHoraOcorrencia] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [endereco, setEndereco] = useState('');
  const [buscandoGPS, setBuscandoGPS] = useState(false);
  const [localizacaoObtida, setLocalizacaoObtida] = useState(false);

  // Etapa 3: Descrição
  const [descricao, setDescricao] = useState('');
  const [terceirosEnvolvidos, setTerceirosEnvolvidos] = useState<boolean | null>(null);
  const [dadosTerceiro, setDadosTerceiro] = useState('');
  const [numeroBO, setNumeroBO] = useState('');

  // Etapa 4: Fotos
  const [fotos, setFotos] = useState<FotoItem[]>([]);

  // Etapa 5: Confirmação
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Navegação
  const handleVoltar = () => {
    if (etapa === 1) {
      setShowSairModal(true);
    } else {
      setEtapa((prev) => prev - 1);
    }
  };

  // Simular GPS
  const handleUsarLocalizacao = () => {
    setBuscandoGPS(true);
    setTimeout(() => {
      setCidade('Uberlândia');
      setEstado('MG');
      setEndereco('Av. Rondon Pacheco, 2000');
      setBuscandoGPS(false);
      setLocalizacaoObtida(true);
      toast.success('Localização obtida!');
    }, 1500);
  };

  // Selecionar tipo e avançar
  const handleSelecionarTipo = (tipoId: string) => {
    setTipoSelecionado(tipoId);
    setTimeout(() => setEtapa(2), 300);
  };

  // Adicionar fotos
  const handleAdicionarFotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const novasFotos = files.slice(0, 10 - fotos.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setFotos((prev) => [...prev, ...novasFotos]);
  };

  // Remover foto
  const removerFoto = (index: number) => {
    setFotos((prev) => {
      const newFotos = prev.filter((_, i) => i !== index);
      return newFotos;
    });
  };

  // Enviar sinistro
  const handleEnviar = async () => {
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 2000));
    setEnviando(false);
    setMostrarSucesso(true);
  };

  // Validações
  const etapa2Valida = dataOcorrencia && horaOcorrencia && cidade && estado && endereco;
  const etapa3Valida = descricao.length >= 20 && (tipoSelecionado !== 'colisao' || terceirosEnvolvidos !== null);

  // Obter tipo selecionado
  const tipoAtual = tiposSinistro.find((t) => t.id === tipoSelecionado);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Sticky */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={handleVoltar}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Comunicar Sinistro</span>
          <Button variant="ghost" size="icon" onClick={() => setShowSairModal(true)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Etapa {etapa} de 5</span>
            <span className="text-xs text-gray-500">{etapa * 20}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${etapa * 20}%` }}
            />
          </div>
        </div>
      </header>

      {/* ETAPA 1: Tipo de Sinistro */}
      {etapa === 1 && (
        <div className="p-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">O que aconteceu?</h2>
            <p className="text-gray-500 mt-1">Selecione o tipo de ocorrência</p>
          </div>

          {/* Grid de tipos */}
          <div className="grid grid-cols-2 gap-3">
            {tiposSinistro.map((tipo) => {
              const IconComponent = tipo.icon;
              return (
                <button
                  key={tipo.id}
                  onClick={() => handleSelecionarTipo(tipo.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    tipoSelecionado === tipo.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${tipo.bgColor} flex items-center justify-center mb-2`}>
                    <IconComponent className={`h-5 w-5 ${tipo.iconColor}`} />
                  </div>
                  <div className="font-medium text-gray-900">{tipo.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{tipo.descricao}</div>
                </button>
              );
            })}
          </div>

          {/* Alerta importante */}
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 font-medium">Em caso de roubo ou furto</p>
                <p className="text-xs text-amber-700 mt-1">
                  Registre o Boletim de Ocorrência (B.O.) imediatamente. Você precisará anexá-lo para dar continuidade ao processo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ETAPA 2: Data, Hora e Local */}
      {etapa === 2 && (
        <div className="p-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <MapPin className="h-8 w-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Quando e onde?</h2>
            <p className="text-gray-500 mt-1">Informe os detalhes da ocorrência</p>
          </div>

          <div className="space-y-4">
            {/* Data */}
            <div>
              <Label className="text-sm font-medium">Data da ocorrência *</Label>
              <Input
                type="date"
                value={dataOcorrencia}
                onChange={(e) => setDataOcorrencia(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="mt-1"
              />
            </div>

            {/* Hora */}
            <div>
              <Label className="text-sm font-medium">Hora aproximada *</Label>
              <Input
                type="time"
                value={horaOcorrencia}
                onChange={(e) => setHoraOcorrencia(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Divisor */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-3 text-sm text-gray-500">Local da ocorrência</span>
              </div>
            </div>

            {/* Botão GPS */}
            <Button
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={handleUsarLocalizacao}
              disabled={buscandoGPS}
            >
              {buscandoGPS ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Obtendo localização...
                </>
              ) : localizacaoObtida ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Localização obtida
                </>
              ) : (
                <>
                  <Navigation className="h-5 w-5 text-blue-500" />
                  Usar minha localização atual
                </>
              )}
            </Button>

            {/* Cidade e Estado */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-sm font-medium">Cidade *</Label>
                <Input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Uberlândia"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">UF *</Label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFs.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <Label className="text-sm font-medium">Endereço ou local de referência *</Label>
              <Input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Ex: Av. Brasil, 1000 ou Próximo ao Shopping"
                className="mt-1"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setEtapa(1)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={() => setEtapa(3)} className="flex-1" disabled={!etapa2Valida}>
              Continuar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ETAPA 3: Descrição do Ocorrido */}
      {etapa === 3 && (
        <div className="p-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-3">
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Conte o que aconteceu</h2>
            <p className="text-gray-500 mt-1">Descreva a ocorrência com detalhes</p>
          </div>

          {/* Textarea principal */}
          <div>
            <Label className="text-sm font-medium">Descrição detalhada *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva como aconteceu, circunstâncias, pessoas envolvidas, danos visíveis..."
              className="mt-1 min-h-[150px] resize-none"
              maxLength={2000}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">Seja o mais detalhado possível</span>
              <span className={`text-xs ${descricao.length > 1800 ? 'text-amber-500' : 'text-gray-400'}`}>
                {descricao.length}/2000
              </span>
            </div>
          </div>

          {/* Perguntas específicas para colisão */}
          {tipoSelecionado === 'colisao' && (
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-sm font-medium">Houve terceiros envolvidos? *</Label>
                <div className="flex gap-3 mt-2">
                  <Button
                    type="button"
                    variant={terceirosEnvolvidos === true ? 'default' : 'outline'}
                    onClick={() => setTerceirosEnvolvidos(true)}
                    className="flex-1"
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant={terceirosEnvolvidos === false ? 'default' : 'outline'}
                    onClick={() => setTerceirosEnvolvidos(false)}
                    className="flex-1"
                  >
                    Não
                  </Button>
                </div>
              </div>

              {terceirosEnvolvidos && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <Label className="text-sm font-medium">Dados do terceiro (se souber)</Label>
                  <Input
                    value={dadosTerceiro}
                    onChange={(e) => setDadosTerceiro(e.target.value)}
                    placeholder="Nome, placa, telefone..."
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* B.O. para roubo/furto */}
          {['roubo', 'furto'].includes(tipoSelecionado || '') && (
            <div className="mt-4">
              <Label className="text-sm font-medium">Número do Boletim de Ocorrência</Label>
              <Input
                value={numeroBO}
                onChange={(e) => setNumeroBO(e.target.value)}
                placeholder="Ex: 123456/2024"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Se ainda não registrou, você poderá informar depois</p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setEtapa(2)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={() => setEtapa(4)} className="flex-1" disabled={!etapa3Valida}>
              Continuar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ETAPA 4: Fotos e Documentos */}
      {etapa === 4 && (
        <div className="p-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
              <Camera className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Adicione fotos</h2>
            <p className="text-gray-500 mt-1">Fotos ajudam na análise do sinistro</p>
          </div>

          {/* Dicas de fotos */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800 font-medium mb-2">📸 Dicas para boas fotos:</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Tire fotos de todos os ângulos do veículo</li>
              <li>• Fotografe de perto os danos</li>
              <li>• Inclua fotos do local da ocorrência</li>
              <li>• Se houver B.O., fotografe o documento</li>
            </ul>
          </div>

          {/* Grid de fotos */}
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((foto, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img src={foto.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removerFoto(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            ))}

            {fotos.length < 10 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAdicionarFotos}
                  className="hidden"
                />
                <Plus className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-gray-500 mt-1">Adicionar</span>
              </label>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center mt-2">{fotos.length}/10 fotos • Máx. 5MB cada</p>

          {/* Tipos de foto sugeridos */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Fotos sugeridas:</p>
            <div className="flex flex-wrap gap-2">
              {fotosSugeridas.map((tipo) => (
                <Badge key={tipo} variant="outline" className="text-xs">
                  {tipo}
                </Badge>
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setEtapa(3)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={() => setEtapa(5)} className="flex-1">
              {fotos.length === 0 ? 'Pular' : 'Continuar'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ETAPA 5: Confirmação e Envio */}
      {etapa === 5 && (
        <div className="p-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3">
              <ClipboardCheck className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Confirme os dados</h2>
            <p className="text-gray-500 mt-1">Revise antes de enviar</p>
          </div>

          {/* Resumo em cards */}
          <div className="space-y-3">
            {/* Veículo */}
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Car className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Veículo</div>
                    <div className="font-medium">
                      {veiculoMock.modelo} • {veiculoMock.placa}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tipo */}
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {tipoAtual && (
                    <div className={`p-2 rounded-lg ${tipoAtual.bgColor}`}>
                      <tipoAtual.icon className={`h-5 w-5 ${tipoAtual.iconColor}`} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Tipo de sinistro</div>
                    <div className="font-medium">{tipoAtual?.nome}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEtapa(1)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data e Local */}
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Quando e onde</div>
                    <div className="font-medium">
                      {dataOcorrencia} às {horaOcorrencia}
                    </div>
                    <div className="text-sm text-gray-600">{endereco}</div>
                    <div className="text-sm text-gray-500">
                      {cidade}/{estado}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEtapa(2)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Descrição */}
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Descrição</div>
                    <div className="text-sm text-gray-700 line-clamp-3">{descricao}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEtapa(3)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Fotos */}
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Camera className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Fotos anexadas</div>
                    <div className="font-medium">{fotos.length} foto(s)</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEtapa(4)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                {fotos.length > 0 && (
                  <div className="flex gap-1 mt-2 overflow-x-auto">
                    {fotos.slice(0, 5).map((foto, i) => (
                      <img key={i} src={foto.preview} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                    ))}
                    {fotos.length > 5 && (
                      <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600 flex-shrink-0">
                        +{fotos.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Termos */}
          <div className="mt-4 flex items-start gap-2">
            <input
              type="checkbox"
              id="termos"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="termos" className="text-xs text-gray-600">
              Declaro que as informações prestadas são verdadeiras e estou ciente de que informações falsas podem
              resultar em cancelamento da cobertura.
            </label>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setEtapa(4)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={!aceitouTermos || enviando}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Sinistro
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Sucesso */}
      <Dialog open={mostrarSucesso}>
        <DialogContent className="text-center mx-4 rounded-2xl">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <DialogTitle className="text-xl">Sinistro Comunicado!</DialogTitle>
          <p className="text-gray-500 mt-2">Seu sinistro foi registrado com sucesso.</p>

          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <div className="text-sm text-gray-500">Protocolo</div>
            <div className="text-2xl font-mono font-bold text-gray-900">{protocoloGerado}</div>
          </div>

          <p className="text-sm text-gray-600 mt-4">
            Nossa equipe irá analisar e entrar em contato em até 24 horas úteis.
          </p>

          <Button onClick={() => navigate('/app/sinistros')} className="w-full mt-4">
            Ver Meus Sinistros
          </Button>
        </DialogContent>
      </Dialog>

      {/* Modal Sair Sem Salvar */}
      <Dialog open={showSairModal} onOpenChange={setShowSairModal}>
        <DialogContent className="mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Sair sem salvar?
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">Você perderá todas as informações preenchidas. Tem certeza?</p>
          <DialogFooter className="flex gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowSairModal(false)} className="flex-1">
              Continuar preenchendo
            </Button>
            <Button variant="destructive" onClick={() => navigate('/app')} className="flex-1">
              Sair mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <AppBottomNav />
    </div>
  );
}
