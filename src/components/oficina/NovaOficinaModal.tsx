import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CnpjInput, TelefoneInput, CepInput } from '@/components/inputs/MaskedInputs';
import { validateCNPJ } from '@/lib/validations';
import { buscarCep } from '@/lib/cep';
import {
  ESPECIALIDADES_OFICINA,
  ESPECIALIDADE_LABELS,
  PIX_TIPO_LABELS,
  BANCOS_BRASIL,
  UFS_BRASIL,
  type TipoPix,
  type EspecialidadeOficina,
  type Oficina,
} from '@/types/database';
import { Building, MapPin, CreditCard, ChevronDown } from 'lucide-react';

interface NovaOficinaModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (oficina: Oficina) => void;
}

// Schema de validação
const formSchema = z.object({
  razao_social: z.string().min(3, 'Razão social é obrigatória'),
  nome_fantasia: z.string().optional(),
  cnpj: z.string()
    .min(18, 'CNPJ inválido')
    .refine((val) => validateCNPJ(val), 'CNPJ inválido'),
  inscricao_estadual: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  especialidades: z.array(z.string()).default([]),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Estado é obrigatório'),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix_tipo: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional().nullable(),
  pix_chave: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const defaultFormData: FormData = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  inscricao_estadual: '',
  telefone: '',
  whatsapp: '',
  email: '',
  especialidades: [],
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  banco: '',
  agencia: '',
  conta: '',
  pix_tipo: null,
  pix_chave: '',
};

export function NovaOficinaModal({ open, onClose, onSuccess }: NovaOficinaModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('dados');
  const [buscandoCep, setBuscandoCep] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: result, error } = await supabase
        .from('oficinas')
        .insert({
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia || null,
          cnpj: data.cnpj,
          inscricao_estadual: data.inscricao_estadual || null,
          telefone: data.telefone || null,
          whatsapp: data.whatsapp || null,
          email: data.email || null,
          cep: data.cep || null,
          logradouro: data.logradouro || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade,
          estado: data.estado,
          banco: data.banco || null,
          agencia: data.agencia || null,
          conta: data.conta || null,
          pix_chave: data.pix_chave || null,
          pix_tipo: data.pix_tipo || null,
          especialidades: data.especialidades,
          status: 'ativo',
        })
        .select()
        .single();

      if (error) throw error;
      return result as Oficina;
    },
    onSuccess: (data) => {
      toast.success('Oficina cadastrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['oficinas'] });
      onSuccess?.(data);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar oficina: ${error.message}`);
    },
  });

  const handleClose = () => {
    setFormData(defaultFormData);
    setErrors({});
    setActiveTab('dados');
    onClose();
  };

  const handleCepComplete = async (cep: string) => {
    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        setFormData((prev) => ({
          ...prev,
          logradouro: endereco.logradouro || prev.logradouro,
          bairro: endereco.bairro || prev.bairro,
          cidade: endereco.cidade || prev.cidade,
          estado: endereco.uf || prev.estado,
        }));
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleEspecialidadeToggle = (esp: string) => {
    setFormData((prev) => ({
      ...prev,
      especialidades: prev.especialidades.includes(esp)
        ? prev.especialidades.filter((e) => e !== esp)
        : [...prev.especialidades, esp],
    }));
  };

  const validateForm = (): boolean => {
    const result = formSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      
      // Navegar para a tab com erro
      if (newErrors.razao_social || newErrors.cnpj || newErrors.email) {
        setActiveTab('dados');
      } else if (newErrors.cidade || newErrors.estado) {
        setActiveTab('endereco');
      }
      
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    createMutation.mutate(formData);
  };

  const updateField = (field: keyof FormData, value: string | string[] | TipoPix | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Nova Oficina</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Dados Gerais
            </TabsTrigger>
            <TabsTrigger value="endereco" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </TabsTrigger>
            <TabsTrigger value="bancario" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Dados Bancários
            </TabsTrigger>
          </TabsList>

          {/* TAB DADOS GERAIS */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="razao_social">Razão Social *</Label>
                <Input
                  id="razao_social"
                  value={formData.razao_social}
                  onChange={(e) => updateField('razao_social', e.target.value)}
                  className={errors.razao_social ? 'border-destructive' : ''}
                />
                {errors.razao_social && (
                  <p className="text-sm text-destructive mt-1">{errors.razao_social}</p>
                )}
              </div>

              <div>
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  value={formData.nome_fantasia}
                  onChange={(e) => updateField('nome_fantasia', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="cnpj">CNPJ *</Label>
                <CnpjInput
                  value={formData.cnpj}
                  onChange={(val) => updateField('cnpj', val)}
                  className={errors.cnpj ? 'border-destructive' : ''}
                />
                {errors.cnpj && (
                  <p className="text-sm text-destructive mt-1">{errors.cnpj}</p>
                )}
              </div>

              <div>
                <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                <Input
                  id="inscricao_estadual"
                  value={formData.inscricao_estadual}
                  onChange={(e) => updateField('inscricao_estadual', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <TelefoneInput
                  value={formData.telefone || ''}
                  onChange={(val) => updateField('telefone', val)}
                />
              </div>

              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <TelefoneInput
                  value={formData.whatsapp || ''}
                  onChange={(val) => updateField('whatsapp', val)}
                />
              </div>

              <div className="col-span-2">
                <Label>Especialidades</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {formData.especialidades.length > 0
                        ? `${formData.especialidades.length} selecionada(s)`
                        : 'Selecione as especialidades...'}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-2">
                      {ESPECIALIDADES_OFICINA.map((esp) => (
                        <div key={esp} className="flex items-center gap-2">
                          <Checkbox
                            id={esp}
                            checked={formData.especialidades.includes(esp)}
                            onCheckedChange={() => handleEspecialidadeToggle(esp)}
                          />
                          <label
                            htmlFor={esp}
                            className="text-sm cursor-pointer"
                          >
                            {ESPECIALIDADE_LABELS[esp as EspecialidadeOficina]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </TabsContent>

          {/* TAB ENDEREÇO */}
          <TabsContent value="endereco" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cep">CEP</Label>
                <CepInput
                  value={formData.cep || ''}
                  onChange={(val) => updateField('cep', val)}
                  onCepComplete={handleCepComplete}
                  disabled={buscandoCep}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={formData.logradouro}
                  onChange={(e) => updateField('logradouro', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => updateField('numero', e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={formData.complemento}
                  onChange={(e) => updateField('complemento', e.target.value)}
                />
              </div>

              <div className="col-span-3">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => updateField('bairro', e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="cidade">Cidade *</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => updateField('cidade', e.target.value)}
                  className={errors.cidade ? 'border-destructive' : ''}
                />
                {errors.cidade && (
                  <p className="text-sm text-destructive mt-1">{errors.cidade}</p>
                )}
              </div>

              <div>
                <Label htmlFor="estado">Estado *</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(val) => updateField('estado', val)}
                >
                  <SelectTrigger className={errors.estado ? 'border-destructive' : ''}>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS_BRASIL.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.estado && (
                  <p className="text-sm text-destructive mt-1">{errors.estado}</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB DADOS BANCÁRIOS */}
          <TabsContent value="bancario" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <Label htmlFor="banco">Banco</Label>
                <Select
                  value={formData.banco}
                  onValueChange={(val) => updateField('banco', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS_BRASIL.map((banco) => (
                      <SelectItem key={banco.codigo} value={banco.codigo}>
                        {banco.codigo} - {banco.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="agencia">Agência</Label>
                <Input
                  id="agencia"
                  value={formData.agencia}
                  onChange={(e) => updateField('agencia', e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="conta">Conta</Label>
                <Input
                  id="conta"
                  value={formData.conta}
                  onChange={(e) => updateField('conta', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="pix_tipo">Tipo da Chave PIX</Label>
                <Select
                  value={formData.pix_tipo || ''}
                  onValueChange={(val) => updateField('pix_tipo', val as TipoPix)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PIX_TIPO_LABELS) as TipoPix[]).map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {PIX_TIPO_LABELS[tipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="pix_chave">Chave PIX</Label>
                <Input
                  id="pix_chave"
                  value={formData.pix_chave}
                  onChange={(e) => updateField('pix_chave', e.target.value)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
