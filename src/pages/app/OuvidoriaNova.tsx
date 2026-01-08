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
  LucideIcon
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
import { setoresElogio } from "@/constants/ouvidoria";

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
  const [setorElogio, setSetorElogio] = useState('');
  const [colaborador, setColaborador] = useState('');

  const tipoConfig = tiposConfig[tipoParam] || tiposConfig.reclamacao;
  const Icon = tipoConfig.icon;
  
  // Obter label do setor selecionado
  const setorLabel = setorElogio 
    ? setoresElogio.find(s => s.value === setorElogio)?.label 
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
    
    // Validação para elogio
    if (tipoParam === 'elogio') {
      if (!setorElogio || !assunto || descricao.length < 20) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    } else {
      if (!categoria || !assunto || descricao.length < 20) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    }

    setIsSubmitting(true);
    
    // Simula envio
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const protocolo = `OUV-2026-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    
    toast.success(`Manifestação enviada! Protocolo: ${protocolo}`);
    navigate('/app/ouvidoria/lista');
  };

  // Verifica se o formulário está válido
  const isFormValid = tipoParam === 'elogio'
    ? setorElogio && assunto && descricao.length >= 20
    : categoria && assunto && descricao.length >= 20;

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

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* === CAMPOS ESPECÍFICOS PARA ELOGIO === */}
        {tipoParam === 'elogio' ? (
          <>
            {/* 1. Setor do Profissional (obrigatório) */}
            <div className="space-y-2">
              <Label htmlFor="setor">Qual setor do profissional que você deseja elogiar? *</Label>
              <Select value={setorElogio} onValueChange={setSetorElogio}>
                <SelectTrigger className={setorElogio ? "border-green-500" : ""}>
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  {setoresElogio.map(setor => (
                    <SelectItem key={setor.value} value={setor.value}>
                      {setor.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {setorLabel && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {setorLabel}
                </Badge>
              )}
            </div>

            {/* 2. Nome do Profissional (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="colaborador">Nome do Profissional (opcional)</Label>
              <Input
                id="colaborador"
                placeholder="Se souber, informe o nome"
                value={colaborador}
                onChange={(e) => setColaborador(e.target.value)}
              />
            </div>

            {/* 3. Assunto (obrigatório) */}
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

            {/* 4. Descrição (obrigatório) */}
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
          </>
        ) : (
          <>
            {/* === CAMPOS PARA OUTROS TIPOS === */}
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
          </>
        )}

        {/* 5. Anexos (opcional) - para todos os tipos */}
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
          disabled={isSubmitting || !isFormValid}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar'}
        </Button>
      </form>
    </div>
  );
}
