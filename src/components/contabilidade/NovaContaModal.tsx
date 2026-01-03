import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContaPai {
  id: string;
  codigo: string;
  descricao: string;
  nivel: number;
  tipo: string;
  natureza: string;
}

interface NovaContaModalProps {
  open: boolean;
  onClose: () => void;
  contaPai?: ContaPai | null;
}

export function NovaContaModal({ open, onClose, contaPai }: NovaContaModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    codigo: '',
    descricao: '',
    tipo: contaPai?.tipo || '',
    natureza: contaPai?.natureza || '',
    sintetica: false,
  });

  const isNivel1 = !contaPai;

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let novoCodigo = data.codigo;

      // Gerar código automaticamente para subcontas
      if (contaPai && !data.codigo) {
        const { data: ultimaFilha } = await supabase
          .from('plano_contas')
          .select('codigo')
          .eq('conta_pai_id', contaPai.id)
          .order('codigo', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ultimaFilha) {
          const partes = ultimaFilha.codigo.split('.');
          const ultimoNumero = parseInt(partes[partes.length - 1]) + 1;
          partes[partes.length - 1] = String(ultimoNumero).padStart(3, '0');
          novoCodigo = partes.join('.');
        } else {
          novoCodigo = contaPai.codigo + '.001';
        }
      }

      const { data: novaConta, error } = await supabase
        .from('plano_contas')
        .insert({
          codigo: novoCodigo,
          descricao: data.descricao,
          conta_pai_id: contaPai?.id || null,
          nivel: contaPai ? contaPai.nivel + 1 : 1,
          tipo: data.tipo || contaPai?.tipo,
          natureza: data.natureza || contaPai?.natureza,
          sintetica: data.sintetica,
          aceita_lancamento: !data.sintetica,
          ativa: true,
        })
        .select()
        .single();

      if (error) throw error;
      return novaConta;
    },
    onSuccess: () => {
      toast.success('Conta criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar conta: ' + error.message);
    },
  });

  const handleClose = () => {
    setFormData({
      codigo: '',
      descricao: '',
      tipo: '',
      natureza: '',
      sintetica: false,
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isNivel1 && !formData.codigo) {
      toast.error('Código é obrigatório para contas de nível 1');
      return;
    }

    if (!formData.descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    if (isNivel1 && !formData.tipo) {
      toast.error('Tipo é obrigatório para contas de nível 1');
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contaPai ? `Nova Subconta de ${contaPai.codigo}` : 'Nova Conta'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info da conta pai */}
          {contaPai && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Conta pai</p>
              <p className="font-medium">
                {contaPai.codigo} - {contaPai.descricao}
              </p>
            </div>
          )}

          {/* Código */}
          <div className="space-y-2">
            <Label htmlFor="codigo">Código {isNivel1 && '*'}</Label>
            <Input
              id="codigo"
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              placeholder={isNivel1 ? 'Ex: 1' : 'Gerado automaticamente'}
              disabled={!isNivel1 && !formData.codigo}
            />
            {!isNivel1 && (
              <p className="text-xs text-muted-foreground">
                Deixe em branco para gerar automaticamente
              </p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Nome da conta"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo {isNivel1 && '*'}</Label>
            <Select
              value={formData.tipo || contaPai?.tipo}
              onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              disabled={!isNivel1}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="passivo">Passivo</SelectItem>
                <SelectItem value="patrimonio">Patrimônio Líquido</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
            {!isNivel1 && (
              <p className="text-xs text-muted-foreground">
                Herdado da conta pai
              </p>
            )}
          </div>

          {/* Natureza */}
          <div className="space-y-2">
            <Label htmlFor="natureza">Natureza {isNivel1 && '*'}</Label>
            <Select
              value={formData.natureza || contaPai?.natureza}
              onValueChange={(v) => setFormData({ ...formData, natureza: v })}
              disabled={!isNivel1}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a natureza" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="devedora">Devedora</SelectItem>
                <SelectItem value="credora">Credora</SelectItem>
              </SelectContent>
            </Select>
            {!isNivel1 && (
              <p className="text-xs text-muted-foreground">
                Herdado da conta pai
              </p>
            )}
          </div>

          {/* Sintética */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sintetica"
              checked={formData.sintetica}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, sintetica: checked === true })
              }
            />
            <Label htmlFor="sintetica" className="font-normal cursor-pointer">
              Conta Sintética (agrupa outras contas)
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
