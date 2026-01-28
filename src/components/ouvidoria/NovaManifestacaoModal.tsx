import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  User, 
  Phone, 
  Mail, 
  ChevronsUpDown,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canaisOrigem,
  tiposManifestacao,
  categoriasManifestacao,
  prioridades,
  setoresElogio,
} from "@/constants/ouvidoria";
import type { CanalManifestacao, TipoManifestacao, CategoriaManifestacao, PrioridadeManifestacao } from "@/types/ouvidoria";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCreateManifestacao } from "@/hooks/useOuvidoria";

interface Associado {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
}

interface NovaManifestacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (id: string, iniciarAtendimento: boolean) => void;
}

export function NovaManifestacaoModal({ open, onOpenChange, onSuccess }: NovaManifestacaoModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateManifestacao();
  
  // Busca de associado
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssociado, setSelectedAssociado] = useState<Associado | null>(null);
  const [isAnonimo, setIsAnonimo] = useState(false);
  
  // Dados da manifestação
  const [canal, setCanal] = useState<CanalManifestacao | "">("");
  const [tipo, setTipo] = useState<TipoManifestacao | "">("");
  const [setorElogio, setSetorElogio] = useState("");
  const [categoria, setCategoria] = useState<CategoriaManifestacao | "">("");
  const [prioridade, setPrioridade] = useState<PrioridadeManifestacao>("normal");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  
  // Informações adicionais
  const [dataContato, setDataContato] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [observacaoInterna, setObservacaoInterna] = useState("");
  
  // Ações pós-cadastro
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(true);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [iniciarAtendimento, setIniciarAtendimento] = useState(false);
  
  // Busca real de associados do banco
  const { data: associadosData, isLoading: isLoadingAssociados } = useQuery({
    queryKey: ["associados-busca-ouvidoria", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("associados")
        .select("id, nome, cpf, telefone, email")
        .or(`nome.ilike.%${searchQuery}%,cpf.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data as Associado[];
    },
    enabled: searchQuery.length >= 2,
  });
  
  const filteredAssociados = associadosData || [];
  
  // Validação do formulário
  const isFormValid = useMemo(() => {
    const hasAssociadoOrAnonimo = isAnonimo || selectedAssociado;
    const hasRequiredFields = canal && tipo && categoria && assunto.trim() && descricao.trim().length >= 20;
    const hasSetorIfElogio = tipo !== 'elogio' || setorElogio;
    return hasAssociadoOrAnonimo && hasRequiredFields && hasSetorIfElogio;
  }, [isAnonimo, selectedAssociado, canal, tipo, categoria, assunto, descricao, setorElogio]);
  
  // Quando seleciona tipo urgente, forçar prioridade urgente
  const handleTipoChange = (value: TipoManifestacao) => {
    setTipo(value);
    if (value === 'reclamacao_urgente') {
      setPrioridade('urgente');
    }
  };
  
  const resetForm = () => {
    setSearchQuery("");
    setSelectedAssociado(null);
    setIsAnonimo(false);
    setCanal("");
    setTipo("");
    setSetorElogio("");
    setCategoria("");
    setPrioridade("normal");
    setAssunto("");
    setDescricao("");
    setDataContato(new Date().toISOString().slice(0, 16));
    setObservacaoInterna("");
    setEnviarWhatsapp(true);
    setEnviarEmail(false);
    setIniciarAtendimento(false);
  };
  
  const handleSubmit = async () => {
    if (!isFormValid) return;
    
    try {
      const result = await createMutation.mutateAsync({
        associado_id: isAnonimo ? undefined : selectedAssociado?.id,
        tipo: tipo as TipoManifestacao,
        categoria: categoria as CategoriaManifestacao,
        assunto,
        descricao,
        anonimo: isAnonimo,
        canal: canal as CanalManifestacao,
        prioridade,
        setor_elogio: setorElogio || undefined,
        data_contato: dataContato,
        observacao_interna: observacaoInterna || undefined,
      });
      
      resetForm();
      onOpenChange(false);
      
      if (iniciarAtendimento && result) {
        onSuccess?.(result.id, true);
        navigate(`/ouvidoria/${result.id}`);
      } else if (result) {
        onSuccess?.(result.id, false);
      }
    } catch (error) {
      // Erro tratado pelo hook
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Registrar Manifestação</DialogTitle>
          <DialogDescription>
            Cadastro manual de manifestação recebida por outros canais
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-180px)] px-6">
          <div className="space-y-6 py-4">
            {/* Seção 1: Dados do Associado */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dados do Associado
              </h3>
              
              {!isAnonimo && (
                <>
                  <div className="space-y-2">
                    <Label>Buscar Associado</Label>
                    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={searchOpen}
                          className="w-full justify-between font-normal"
                        >
                          {selectedAssociado ? (
                            <span>{selectedAssociado.nome}</span>
                          ) : (
                            <span className="text-muted-foreground">Digite nome ou CPF...</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Digite nome ou CPF..." 
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                          />
                          <CommandList>
                            {isLoadingAssociados ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                Buscando...
                              </div>
                            ) : filteredAssociados.length === 0 && searchQuery.length >= 2 ? (
                              <CommandEmpty>Nenhum associado encontrado.</CommandEmpty>
                            ) : searchQuery.length < 2 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                Digite pelo menos 2 caracteres
                              </div>
                            ) : (
                              <CommandGroup>
                                {filteredAssociados.map((associado) => (
                                  <CommandItem
                                    key={associado.id}
                                    value={associado.id}
                                    onSelect={() => {
                                      setSelectedAssociado(associado);
                                      setSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedAssociado?.id === associado.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{associado.nome}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {associado.cpf}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {selectedAssociado && (
                    <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedAssociado.nome}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>CPF:</span>
                          <span className="text-foreground">{selectedAssociado.cpf}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span className="text-foreground">{selectedAssociado.telefone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                          <Mail className="h-3 w-3" />
                          <span className="text-foreground">{selectedAssociado.email}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="anonimo"
                  checked={isAnonimo}
                  onCheckedChange={(checked) => {
                    setIsAnonimo(checked === true);
                    if (checked) {
                      setSelectedAssociado(null);
                      setEnviarWhatsapp(false);
                      setEnviarEmail(false);
                    }
                  }}
                />
                <Label htmlFor="anonimo" className="text-sm cursor-pointer">
                  Associado não identificado / Manifestação anônima
                </Label>
              </div>
            </div>
            
            {/* Seção 2: Dados da Manifestação */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dados da Manifestação
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Canal de Origem *</Label>
                  <Select value={canal} onValueChange={(v) => setCanal(v as CanalManifestacao)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {canaisOrigem.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <c.icon className="h-4 w-4" />
                            {c.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Tipo de Manifestação *</Label>
                  <Select value={tipo} onValueChange={(v) => handleTipoChange(v as TipoManifestacao)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposManifestacao.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {tipo === 'elogio' && (
                <div className="space-y-2">
                  <Label>Setor Elogiado *</Label>
                  <Select value={setorElogio} onValueChange={setSetorElogio}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setoresElogio.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <div className="flex items-center gap-2">
                            <s.icon className="h-4 w-4" />
                            {s.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaManifestacao)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasManifestacao.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select 
                    value={prioridade} 
                    onValueChange={(v) => setPrioridade(v as PrioridadeManifestacao)}
                    disabled={tipo === 'reclamacao_urgente'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {prioridades.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Assunto *</Label>
                <Input
                  placeholder="Resuma a manifestação"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right">{assunto.length}/100</p>
              </div>
              
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Textarea
                  placeholder="Descreva detalhadamente o que foi relatado pelo associado..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {descricao.length} caracteres {descricao.length < 20 && "(mínimo 20)"}
                </p>
              </div>
            </div>
            
            {/* Seção 3: Informações Adicionais */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Informações Adicionais
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data/Hora do Contato</Label>
                  <Input
                    type="datetime-local"
                    value={dataContato}
                    onChange={(e) => setDataContato(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Observações internas (não visível ao associado)</Label>
                <Textarea
                  placeholder="Anotações para a equipe..."
                  value={observacaoInterna}
                  onChange={(e) => setObservacaoInterna(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            
            {/* Seção 4: Ações */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ações
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="whatsapp"
                    checked={enviarWhatsapp}
                    onCheckedChange={(checked) => setEnviarWhatsapp(checked === true)}
                    disabled={isAnonimo || !selectedAssociado}
                  />
                  <Label htmlFor="whatsapp" className="text-sm cursor-pointer">
                    Enviar confirmação por WhatsApp ao associado
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email"
                    checked={enviarEmail}
                    onCheckedChange={(checked) => setEnviarEmail(checked === true)}
                    disabled={isAnonimo || !selectedAssociado}
                  />
                  <Label htmlFor="email" className="text-sm cursor-pointer">
                    Enviar confirmação por E-mail ao associado
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="iniciar"
                    checked={iniciarAtendimento}
                    onCheckedChange={(checked) => setIniciarAtendimento(checked === true)}
                  />
                  <Label htmlFor="iniciar" className="text-sm cursor-pointer">
                    Iniciar atendimento imediatamente
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Manifestação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
