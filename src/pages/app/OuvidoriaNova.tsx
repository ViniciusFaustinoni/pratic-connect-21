import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, 
  AlertCircle, 
  AlertTriangle,
  Lightbulb, 
  ThumbsUp, 
  Shield, 
  Upload,
  X,
  LucideIcon,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SetorElogioSelector } from "@/components/ouvidoria/SetorElogioSelector";
import { setoresElogio } from "@/constants/ouvidoria";
import { SETOR_ELOGIO_LABELS, type SetorElogio } from "@/types/ouvidoria";

interface TipoConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

const tiposConfig: Record<string, TipoConfig> = {
  reclamacao: { label: 'Reclamação', icon: AlertCircle, color: 'text-orange-700', bgColor: 'bg-orange-100' },
  reclamacao_urgente: { label: 'Reclamação Urgente', icon: AlertTriangle, color: 'text-red-700', bgColor: 'bg-red-100' },
  sugestao: { label: 'Sugestão', icon: Lightbulb, color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  elogio: { label: 'Elogio', icon: ThumbsUp, color: 'text-green-700', bgColor: 'bg-green-100' },
  denuncia: { label: 'Denúncia', icon: Shield, color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

const categorias = [
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'sinistro', label: 'Sinistro' },
  { value: 'assistencia', label: 'Assistência' },
  { value: 'rastreamento', label: 'Rastreamento' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'app', label: 'Aplicativo' },
  { value: 'outro', label: 'Outro' },
];

export default function OuvidoriaNova() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get('tipo') || 'reclamacao';
  
  const [categoria, setCategoria] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anonimo, setAnonimo] = useState(false);
  const [anexos, setAnexos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Campos específicos para elogio
  const [setorElogio, setSetorElogio] = useState<string | null>(null);
  const [colaborador, setColaborador] = useState('');
  const [dataAtendimento, setDataAtendimento] = useState('');
  const [etapa, setEtapa] = useState<'setor' | 'formulario'>(
    tipoParam === 'elogio' ? 'setor' : 'formulario'
  );

  const tipoConfig = tiposConfig[tipoParam] || tiposConfig.reclamacao;
  const Icon = tipoConfig.icon;
  
  // Obter dados do setor selecionado
  const setorSelecionado = setorElogio 
    ? setoresElogio.find(s => s.id === setorElogio) 
    : null;

  const handleAnexoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (anexos.length + files.length > 5) {
      toast.error('Máximo de 5 anexos permitidos');
      return;
    }
    setAnexos(prev => [...prev, ...files]);
  };

  const removeAnexo = (index: number) => {
    setAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoria || !assunto || descricao.length < 20) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    if (tipoParam === 'elogio' && !setorElogio) {
      toast.error('Selecione o setor do elogio');
      return;
    }

    setIsSubmitting(true);
    
    // Simula envio
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const protocolo = `OUV-2026-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    
    toast.success(`Manifestação enviada! Protocolo: ${protocolo}`);
    navigate('/app/ouvidoria/lista');
  };

  // Se for elogio e estiver na etapa de seleção de setor
  if (tipoParam === 'elogio' && etapa === 'setor') {
    return (
      <div className="p-4 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/ouvidoria')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Novo Elogio</h1>
        </div>

        {/* Badge do tipo */}
        <Badge className="bg-green-100 text-green-700 border-0 gap-2">
          <ThumbsUp className="h-4 w-4" />
          Elogio
        </Badge>

        {/* Seleção de Setor */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Para qual setor é seu elogio?</h2>
            <p className="text-muted-foreground text-sm">
              Selecione o departamento que você deseja elogiar
            </p>
          </div>
          
          <SetorElogioSelector
            selectedSetor={setorElogio}
            onSelect={setSetorElogio}
            compact
          />
          
          <Button 
            className="w-full bg-green-600 hover:bg-green-700" 
            size="lg"
            disabled={!setorElogio}
            onClick={() => setEtapa('formulario')}
          >
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/ouvidoria')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Nova {tipoConfig.label}</h1>
      </div>

      {/* Badge do tipo */}
      <Badge className={`${tipoConfig.bgColor} ${tipoConfig.color} border-0 gap-2`}>
        <Icon className="h-4 w-4" />
        {tipoConfig.label}
      </Badge>

      {/* Badge do setor selecionado (se elogio) */}
      {tipoParam === 'elogio' && setorSelecionado && (
        <div className="flex items-center justify-between bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center gap-2">
            <setorSelecionado.icon className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {SETOR_ELOGIO_LABELS[setorElogio as SetorElogio]}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setEtapa('setor')}
            className="text-green-700 gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Trocar setor
          </Button>
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Categoria */}
        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria *</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assunto */}
        <div className="space-y-2">
          <Label htmlFor="assunto">Assunto *</Label>
          <Input
            id="assunto"
            placeholder="Resuma em poucas palavras"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value.slice(0, 100))}
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground text-right">
            {assunto.length}/100
          </p>
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição *</Label>
          <Textarea
            id="descricao"
            placeholder="Conte o que aconteceu..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value.slice(0, 2000))}
            rows={6}
            className="resize-none"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{descricao.length < 20 && descricao.length > 0 ? 'Mínimo 20 caracteres' : ''}</span>
            <span>{descricao.length}/2000</span>
          </div>
        </div>

        {/* Campos específicos para elogio */}
        {tipoParam === 'elogio' && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 space-y-4">
              {/* Campo Colaborador */}
              <div className="space-y-2">
                <Label>Deseja mencionar algum colaborador específico?</Label>
                <Input
                  placeholder="Nome do funcionário que te atendeu (opcional)"
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-green-700">
                  Se souber o nome, isso nos ajuda a reconhecer a pessoa certa!
                </p>
              </div>
              
              {/* Campo Data Atendimento */}
              <div className="space-y-2">
                <Label>Quando foi o atendimento?</Label>
                <Input
                  type="date"
                  value={dataAtendimento}
                  onChange={(e) => setDataAtendimento(e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-green-700">
                  Aproximadamente, para identificarmos melhor
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Anexos */}
        <div className="space-y-2">
          <Label>Anexos (opcional)</Label>
          <div className="border-2 border-dashed rounded-lg p-4">
            <input
              type="file"
              id="anexos"
              className="hidden"
              accept="image/*,.pdf"
              multiple
              onChange={handleAnexoChange}
            />
            <label 
              htmlFor="anexos" 
              className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground"
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm">Clique para adicionar arquivos</span>
              <span className="text-xs">Imagens ou PDF (máx. 5)</span>
            </label>
          </div>
          
          {anexos.length > 0 && (
            <div className="space-y-2">
              {anexos.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-muted rounded-lg p-2">
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeAnexo(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opção anônimo (só para denúncia) */}
        {tipoParam === 'denuncia' && (
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="anonimo"
                  checked={anonimo}
                  onCheckedChange={(checked) => setAnonimo(checked === true)}
                />
                <Label htmlFor="anonimo" className="text-purple-800 cursor-pointer">
                  Desejo fazer de forma anônima
                </Label>
              </div>
              {anonimo && (
                <p className="text-xs text-purple-700">
                  Ao optar pelo anonimato, não poderemos entrar em contato para esclarecimentos 
                  ou informar o resultado da apuração.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Botão enviar */}
        <Button 
          type="submit" 
          className={tipoParam === 'elogio' ? "w-full bg-green-600 hover:bg-green-700" : "w-full"} 
          size="lg"
          disabled={isSubmitting || !categoria || !assunto || descricao.length < 20}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar'}
        </Button>
      </form>
    </div>
  );
}
