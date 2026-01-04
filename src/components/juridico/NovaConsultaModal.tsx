import { useState } from 'react';
import { 
  HelpCircle, 
  Building, 
  AlertCircle, 
  ChevronDown, 
  Loader2, 
  Scale,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AssociadoCombobox } from '@/components/cadastro/AssociadoCombobox';
import { SinistroCombobox } from '@/components/oficina/SinistroCombobox';
import { cn } from '@/lib/utils';

interface NovaConsultaModalProps {
  open: boolean;
  onClose: () => void;
}

const DEPARTAMENTOS = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'cadastro', label: 'Cadastro' },
  { value: 'monitoramento', label: 'Monitoramento' },
  { value: 'sinistros', label: 'Sinistros' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'diretoria', label: 'Diretoria' },
  { value: 'outro', label: 'Outro' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export function NovaConsultaModal({ open, onClose }: NovaConsultaModalProps) {
  const queryClient = useQueryClient();
  
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [associadoId, setAssociadoId] = useState<string | undefined>();
  const [sinistroId, setSinistroId] = useState<string | undefined>();
  const [processoId, setProcessoId] = useState<string | undefined>();
  const [showVinculacoes, setShowVinculacoes] = useState(false);
  const [processoPopoverOpen, setProcessoPopoverOpen] = useState(false);

  // Query para processos (combobox inline)
  const { data: processos = [] } = useQuery({
    queryKey: ['processos-combobox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('id, numero, tipo, parte_contraria_nome')
        .not('status', 'eq', 'arquivado')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const selectedProcesso = processos.find((p) => p.id === processoId);

  const handleClose = () => {
    setAssunto('');
    setDescricao('');
    setDepartamento('');
    setPrioridade('normal');
    setAssociadoId(undefined);
    setSinistroId(undefined);
    setProcessoId(undefined);
    setShowVinculacoes(false);
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('consultas_juridicas')
        .insert({
          assunto,
          descricao,
          departamento: departamento || null,
          prioridade,
          associado_id: associadoId || null,
          sinistro_id: sinistroId || null,
          processo_id: processoId || null,
          solicitante_id: user.data.user?.id,
          status: 'pendente'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Consulta registrada!');
      queryClient.invalidateQueries({ queryKey: ['consultas_juridicas'] });
      queryClient.invalidateQueries({ queryKey: ['consultas-juridicas'] });
      handleClose();
    },
    onError: (error) => {
      toast.error('Erro ao registrar: ' + error.message);
    }
  });

  const isValid = assunto.trim() && descricao.trim();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Nova Consulta Jurídica
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Assunto */}
          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto *</Label>
            <Input
              id="assunto"
              placeholder="Ex: Dúvida sobre cláusula contratual"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
            />
          </div>

          {/* Departamento e Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Departamento
              </Label>
              <Select value={departamento} onValueChange={setDepartamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map((dep) => (
                    <SelectItem key={dep.value} value={dep.value}>
                      {dep.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Prioridade
              </Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((prio) => (
                    <SelectItem key={prio.value} value={prio.value}>
                      {prio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição detalhada *</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva sua dúvida ou solicitação com o máximo de detalhes..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
            />
          </div>

          {/* Vinculações opcionais */}
          <Collapsible open={showVinculacoes} onOpenChange={setShowVinculacoes}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                Vincular a registro (opcional)
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  showVinculacoes && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Associado */}
              <div className="space-y-2">
                <Label className="text-sm">Associado</Label>
                <AssociadoCombobox
                  value={associadoId}
                  onSelect={(id) => setAssociadoId(id)}
                  placeholder="Buscar associado..."
                />
              </div>

              {/* Sinistro */}
              <div className="space-y-2">
                <Label className="text-sm">Sinistro</Label>
                <SinistroCombobox
                  value={sinistroId}
                  onSelect={(sinistro) => setSinistroId(sinistro.id)}
                  placeholder="Buscar sinistro..."
                />
              </div>

              {/* Processo (inline combobox) */}
              <div className="space-y-2">
                <Label className="text-sm">Processo</Label>
                <Popover open={processoPopoverOpen} onOpenChange={setProcessoPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {selectedProcesso ? (
                        <div className="flex items-center gap-2 truncate">
                          <Scale className="h-4 w-4 text-purple-500" />
                          <span>{selectedProcesso.numero}</span>
                          <Badge variant="secondary" className="ml-1">
                            {selectedProcesso.tipo}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Buscar processo...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por número..." />
                      <CommandList>
                        <CommandEmpty>Nenhum processo encontrado.</CommandEmpty>
                        <CommandGroup>
                          {processos.map((processo) => (
                            <CommandItem
                              key={processo.id}
                              value={processo.numero}
                              onSelect={() => {
                                setProcessoId(processo.id);
                                setProcessoPopoverOpen(false);
                              }}
                              className="flex flex-col items-start gap-1 py-2"
                            >
                              <div className="flex w-full items-center gap-2">
                                <Check
                                  className={cn(
                                    'h-4 w-4',
                                    processoId === processo.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <span className="font-medium">{processo.numero}</span>
                                <Badge variant="outline" className="text-xs">
                                  {processo.tipo}
                                </Badge>
                              </div>
                              {processo.parte_contraria_nome && (
                                <span className="ml-6 text-sm text-muted-foreground">
                                  vs {processo.parte_contraria_nome}
                                </span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Consulta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
