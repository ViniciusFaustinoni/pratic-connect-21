import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, 
  AlertCircle, 
  AlertTriangle,
  Lightbulb, 
  ThumbsUp, 
  Shield,
  LucideIcon
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
import { setoresElogio } from "@/constants/ouvidoria";
import { CATEGORIA_LABELS, type TipoManifestacao, type CategoriaManifestacao } from "@/types/ouvidoria";
import { SetorElogioModal } from "@/components/ouvidoria/SetorElogioModal";
import { useCreateManifestacao } from "@/hooks/useOuvidoria";

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
  const setorParam = searchParams.get('setor') || '';
  
  const [tipo, setTipo] = useState<string>(tipoParam || '');
  const [categoria, setCategoria] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anonimo, setAnonimo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Campos específicos para elogio
  const [setorElogio, setSetorElogio] = useState(setorParam);
  const [colaborador, setColaborador] = useState('');
  
  const createMutation = useCreateManifestacao();
  
  // Modal de setores - abrir automaticamente se for elogio sem setor
  const [showSetorModal, setShowSetorModal] = useState(
    tipoParam === 'elogio' && !setorParam
  );
  
  const [etapa, setEtapa] = useState<'tipo' | 'formulario'>(tipoParam ? 'formulario' : 'tipo');

  // Se fechar o modal sem selecionar setor, voltar para seleção de tipo
  useEffect(() => {
    if (tipo === 'elogio' && !setorElogio && !showSetorModal && etapa === 'formulario') {
      setEtapa('tipo');
      setTipo('');
    }
  }, [showSetorModal, tipo, setorElogio, etapa]);

  const tipoConfig = tipo ? tiposConfig[tipo] : null;
  
  // Obter config do setor selecionado
  const setorConfig = setorElogio 
    ? setoresElogio.find(s => s.value === setorElogio)
    : null;
  const setorLabel = setorConfig?.label || null;
  const SetorIcon = setorConfig?.icon || null;

  const handleTipoSelect = (selectedTipo: string) => {
    setTipo(selectedTipo);
    if (selectedTipo === 'elogio') {
      // Abre o modal de seleção de setor
      setShowSetorModal(true);
    } else {
      setEtapa('formulario');
    }
  };

  const handleSetorSelect = (setorValue: string) => {
    setSetorElogio(setorValue);
    setEtapa('formulario');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação para elogio
    if (tipo === 'elogio') {
      if (!setorElogio || !assunto || descricao.length < 20) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    } else {
      if (!tipo || !categoria || !assunto || descricao.length < 20) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      await createMutation.mutateAsync({
        tipo: tipo as TipoManifestacao,
        categoria: tipo !== 'elogio' ? (categoria as CategoriaManifestacao) : undefined,
        assunto,
        descricao,
        anonimo,
        canal: 'app',
        prioridade: tipo === 'reclamacao_urgente' ? 'urgente' : 'normal',
        setor_elogio: setorElogio || undefined,
        colaborador_elogiado: colaborador || undefined,
      });
      navigate('/ouvidoria/manifestacoes');
    } catch (error) {
      // Erro tratado pelo hook
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verifica se o formulário está válido
  const isFormValid = tipo === 'elogio'
    ? setorElogio && assunto && descricao.length >= 20
    : categoria && assunto && descricao.length >= 20;

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

        {/* Modal de seleção de setor para elogio */}
        <SetorElogioModal
          open={showSetorModal}
          onClose={() => setShowSetorModal(false)}
          onSelect={handleSetorSelect}
        />
      </div>
    );
  }

  // Etapa 2: Formulário
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setEtapa('tipo')}>
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

      {/* Badge do setor selecionado (para elogio) */}
      {tipo === 'elogio' && setorLabel && SetorIcon && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SetorIcon className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">Elogio para: {setorLabel}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-green-700 hover:bg-green-100"
              onClick={() => {
                setShowSetorModal(true);
              }}
            >
              Trocar setor
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Manifestação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* === CAMPOS ESPECÍFICOS PARA ELOGIO === */}
              {tipo === 'elogio' ? (
                <>
                  {/* 1. Nome do Profissional (opcional) */}
                  <div className="space-y-2">
                    <Label htmlFor="colaborador">Nome do Profissional (opcional)</Label>
                    <Input
                      id="colaborador"
                      placeholder="Se souber, informe o nome"
                      value={colaborador}
                      onChange={(e) => setColaborador(e.target.value)}
                    />
                  </div>

                  {/* 2. Assunto (obrigatório) */}
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

                  {/* 3. Descrição (obrigatório) */}
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição *</Label>
                    <Textarea
                      id="descricao"
                      placeholder="Descreva o elogio em detalhes..."
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
                </>
              )}

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
                disabled={isSubmitting || !isFormValid}
              >
                {isSubmitting ? 'Criando...' : 'Criar Manifestação'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preview do setor selecionado (apenas para elogio) */}
        {tipo === 'elogio' && setorLabel && (
          <Card className="bg-green-50 border-green-200 h-fit">
            <CardHeader>
              <CardTitle className="text-green-800">Resumo do Elogio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-green-700">Setor:</span>
                <Badge className="bg-green-100 text-green-700">{setorLabel}</Badge>
              </div>
              {colaborador && (
                <div className="flex justify-between">
                  <span className="text-green-700">Profissional:</span>
                  <span className="font-medium text-green-800">{colaborador}</span>
                </div>
              )}
              {assunto && (
                <div className="flex justify-between">
                  <span className="text-green-700">Assunto:</span>
                  <span className="font-medium text-green-800 text-right max-w-[200px] truncate">{assunto}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de seleção de setor para elogio */}
      <SetorElogioModal
        open={showSetorModal}
        onClose={() => setShowSetorModal(false)}
        onSelect={handleSetorSelect}
      />
    </div>
  );
}
