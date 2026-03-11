import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
import { useCreateBeneficio, useUpdateBeneficio, CATEGORIAS_BENEFICIO } from '@/hooks/useBeneficiosAdmin';
import { CustoRealInfo } from '@/components/beneficios/CustoRealInfo';
import { useProductLines } from '@/hooks/useProductLines';
import type { Tables } from '@/integrations/supabase/types';

type BeneficioAdicional = Tables<'beneficios_adicionais'>;

interface BeneficioAdicionalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beneficio: BeneficioAdicional | null;
}

const LINHAS_FALLBACK = [
  { slug: 'select', name: 'Select' },
  { slug: 'select-one', name: 'Select One' },
  { slug: 'especial', name: 'Especial' },
  { slug: 'lancamento', name: 'Lançamento' },
  { slug: 'advanced', name: 'Advanced' },
  { slug: 'eletrico', name: 'Elétrico' },
];

export function BeneficioAdicionalModal({ open, onOpenChange, beneficio }: BeneficioAdicionalModalProps) {
  const createBeneficio = useCreateBeneficio();
  const updateBeneficio = useUpdateBeneficio();
  const { data: productLines } = useProductLines();
  const isEditing = !!beneficio;

  const linhas = productLines?.length
    ? productLines.map(pl => ({ slug: pl.slug, name: pl.name }))
    : LINHAS_FALLBACK;

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    categoria: 'Outro',
    descricao: '',
    preco: 0,
    ativo: true,
    ordem: 0,
    variacao_por_cota: true,
    linhas_permitidas: [] as string[],
  });

  useEffect(() => {
    if (beneficio) {
      setFormData({
        nome: beneficio.nome,
        codigo: beneficio.codigo,
        categoria: beneficio.categoria,
        descricao: beneficio.descricao || '',
        preco: beneficio.preco,
        ativo: beneficio.ativo ?? true,
        ordem: beneficio.ordem ?? 0,
        variacao_por_cota: beneficio.variacao_por_cota ?? true,
        linhas_permitidas: (beneficio as any).linhas_permitidas || [],
      });
    } else {
      setFormData({
        nome: '',
        codigo: '',
        categoria: 'Outro',
        descricao: '',
        preco: 0,
        ativo: true,
        ordem: 0,
        variacao_por_cota: true,
        linhas_permitidas: [],
      });
    }
  }, [beneficio, open]);

  const generateSlug = (nome: string) => {
    return nome
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const toggleLinha = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      linhas_permitidas: prev.linhas_permitidas.includes(slug)
        ? prev.linhas_permitidas.filter(s => s !== slug)
        : [...prev.linhas_permitidas, slug],
    }));
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim() || formData.preco <= 0) return;

    const codigo = formData.codigo.trim() || generateSlug(formData.nome);

    try {
      if (isEditing && beneficio) {
        await updateBeneficio.mutateAsync({
          id: beneficio.id,
          codigo,
          nome: formData.nome,
          categoria: formData.categoria,
          descricao: formData.descricao || null,
          preco: formData.preco,
          ativo: formData.ativo,
          ordem: formData.ordem,
          variacao_por_cota: formData.variacao_por_cota,
          linhas_permitidas: formData.linhas_permitidas,
        });
      } else {
        await createBeneficio.mutateAsync({
          codigo,
          nome: formData.nome,
          categoria: formData.categoria,
          descricao: formData.descricao || null,
          preco: formData.preco,
          ativo: formData.ativo,
          ordem: formData.ordem,
          variacao_por_cota: formData.variacao_por_cota,
          linhas_permitidas: formData.linhas_permitidas,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado nos hooks
    }
  };

  const isPending = createBeneficio.isPending || updateBeneficio.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Benefício Adicional' : 'Novo Benefício Adicional'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: 1000km Reboque"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_BENEFICIO.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linhas Permitidas */}
          <div className="space-y-2">
            <Label>Linhas de Plano Permitidas</Label>
            <p className="text-xs text-muted-foreground">
              Deixe vazio para disponibilizar em todas as linhas
            </p>
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-md">
              {linhas.map(linha => (
                <div key={linha.slug} className="flex items-center space-x-2">
                  <Checkbox
                    id={`linha-${linha.slug}`}
                    checked={formData.linhas_permitidas.includes(linha.slug)}
                    onCheckedChange={() => toggleLinha(linha.slug)}
                  />
                  <label
                    htmlFor={`linha-${linha.slug}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {linha.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Variação por Cota */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="variacao_por_cota" className="text-sm font-medium">
                  Variação por Cota
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formData.variacao_por_cota 
                    ? "Custo dividido pelo total de cotas (baseado no valor FIPE)"
                    : "Custo dividido pelo número de veículos"}
                </p>
              </div>
              <Switch
                id="variacao_por_cota"
                checked={formData.variacao_por_cota}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, variacao_por_cota: checked })
                }
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o benefício..."
              rows={3}
            />
          </div>

          {/* Preço */}
          <div className="space-y-2">
            <Label htmlFor="preco">Preço Mensal (R$) *</Label>
            <Input
              id="preco"
              type="number"
              step="0.01"
              min="0"
              value={formData.preco}
              onChange={(e) => setFormData({ ...formData, preco: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
            
            {isEditing && beneficio ? (
              <CustoRealInfo 
                beneficioId={beneficio.id} 
                tipo="adicional"
                precoAtual={formData.preco}
              />
            ) : (
              <div className="mt-2 p-3 rounded-md border border-muted bg-muted/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  O custo real será calculado após salvar e registrar gastos em sinistros
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ordem">Ordem de Exibição</Label>
              <Input
                id="ordem"
                type="number"
                min="0"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between pt-6">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !formData.nome.trim() || formData.preco <= 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
