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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SETOR_ELOGIO_LABELS, CATEGORIA_LABELS, type SetorElogio, type CategoriaManifestacao } from "@/types/ouvidoria";

interface TipoConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const tiposConfig: Record<string, TipoConfig> = {
  reclamacao: { 
    label: 'Reclamação', 
    icon: AlertCircle, 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-50', 
    borderColor: 'border-orange-300' 
  },
  reclamacao_urgente: { 
    label: 'Reclamação Urgente', 
    icon: AlertTriangle, 
    color: 'text-red-700', 
    bgColor: 'bg-red-50', 
    borderColor: 'border-red-300' 
  },
  sugestao: { 
    label: 'Sugestão', 
    icon: Lightbulb, 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-50', 
    borderColor: 'border-yellow-300' 
  },
  elogio: { 
    label: 'Elogio', 
    icon: ThumbsUp, 
    color: 'text-green-700', 
    bgColor: 'bg-green-50', 
    borderColor: 'border-green-300' 
  },
  denuncia: { 
    label: 'Denúncia', 
    icon: Shield, 
    color: 'text-purple-700', 
    bgColor: 'bg-purple-50', 
    borderColor: 'border-purple-300' 
  },
};

export default function NovaManifestacao() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get('tipo');
  
  const [tipo, setTipo] = useState<string>(tipoParam || '');
  const [categoria, setCategoria] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anonimo, setAnonimo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Campos específicos para elogio
  const [setorElogio, setSetorElogio] = useState<string | null>(null);
  const [colaborador, setColaborador] = useState('');
  const [dataAtendimento, setDataAtendimento] = useState('');
  const [etapa, setEtapa] = useState<'tipo' | 'setor' | 'formulario'>(
    tipoParam === 'elogio' ? 'setor' : tipoParam ? 'formulario' : 'tipo'
  );

  const tipoConfig = tipo ? tiposConfig[tipo] : null;
  
  // Obter dados do setor selecionado
  const setorSelecionado = setorElogio 
    ? setoresElogio.find(s => s.id === setorElogio) 
    : null;

  const handleTipoSelect = (selectedTipo: string) => {
    setTipo(selectedTipo);
    if (selectedTipo === 'elogio') {
      setEtapa('setor');
    } else {
      setEtapa('formulario');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tipo || !categoria || !assunto || descricao.length < 20) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    if (tipo === 'elogio' && !setorElogio) {
      toast.error('Selecione o setor do elogio');
      return;
    }

    setIsSubmitting(true);
    
    // Simula envio
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const protocolo = `OUV-2026-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    
    toast.success(`Manifestação criada! Protocolo: ${protocolo}`);
    navigate('/ouvidoria/manifestacoes');
  };

  // Etapa 1: Seleção de Tipo
  if (etapa === 'tipo') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ouvidoria')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nova Manifestação</h1>
            <p className="text-muted-foreground">Selecione o tipo de manifestação</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {Object.entries(tiposConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Card 
                key={key}
                className={`${config.bgColor} border-2 ${config.borderColor} hover:shadow-lg cursor-pointer transition-all`}
                onClick={() => handleTipoSelect(key)}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <Icon className={`h-12 w-12 ${config.color} mx-auto`} />
                  <p className={`font-bold text-lg ${config.color}`}>{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Etapa 2: Seleção de Setor (apenas para elogio)
  if (etapa === 'setor' && tipo === 'elogio') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setEtapa('tipo')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Novo Elogio</h1>
            <p className="text-muted-foreground">Selecione o setor que deseja elogiar</p>
          </div>
        </div>

        <Badge className="bg-green-100 text-green-700 border-0 gap-2">
          <ThumbsUp className="h-4 w-4" />
          Elogio
        </Badge>

        <Card>
          <CardHeader>
            <CardTitle>Para qual setor é o elogio?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SetorElogioSelector
              selectedSetor={setorElogio}
              onSelect={setSetorElogio}
            />
            
            <Button 
              className="w-full bg-green-600 hover:bg-green-700" 
              size="lg"
              disabled={!setorElogio}
              onClick={() => setEtapa('formulario')}
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Etapa 3: Formulário
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            if (tipo === 'elogio') {
              setEtapa('setor');
            } else {
              setEtapa('tipo');
            }
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tipoConfig ? `Nova ${tipoConfig.label}` : 'Nova Manifestação'}
          </h1>
          <p className="text-muted-foreground">Preencha os dados da manifestação</p>
        </div>
      </div>

      {/* Badge do tipo */}
      {tipoConfig && (
        <Badge className={`${tipoConfig.bgColor} ${tipoConfig.color} border-0 gap-2`}>
          <tipoConfig.icon className="h-4 w-4" />
          {tipoConfig.label}
        </Badge>
      )}

      {/* Badge do setor selecionado (se elogio) */}
      {tipo === 'elogio' && setorSelecionado && (
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Manifestação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Categoria */}
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
                  placeholder="Descreva a manifestação em detalhes..."
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

              {/* Opção anônimo (só para denúncia) */}
              {tipo === 'denuncia' && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <Checkbox
                    id="anonimo"
                    checked={anonimo}
                    onCheckedChange={(checked) => setAnonimo(checked === true)}
                  />
                  <Label htmlFor="anonimo" className="text-purple-800 cursor-pointer">
                    Manifestação anônima
                  </Label>
                </div>
              )}

              {/* Botão enviar */}
              <Button 
                type="submit" 
                className={tipo === 'elogio' ? "w-full bg-green-600 hover:bg-green-700" : "w-full"} 
                size="lg"
                disabled={isSubmitting || !categoria || !assunto || descricao.length < 20}
              >
                {isSubmitting ? 'Criando...' : 'Criar Manifestação'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Campos adicionais para elogio */}
        {tipo === 'elogio' && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800">Informações do Elogio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campo Colaborador */}
              <div className="space-y-2">
                <Label>Colaborador mencionado (opcional)</Label>
                <Input
                  placeholder="Nome do funcionário"
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-green-700">
                  Se souber o nome, isso ajuda a reconhecer a pessoa certa!
                </p>
              </div>
              
              {/* Campo Data Atendimento */}
              <div className="space-y-2">
                <Label>Data do atendimento (opcional)</Label>
                <Input
                  type="date"
                  value={dataAtendimento}
                  onChange={(e) => setDataAtendimento(e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-green-700">
                  Aproximadamente, para identificar melhor
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
