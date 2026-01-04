import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Megaphone, Calendar, DollarSign, Target, Link, User, Save
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const tipoOptions = [
  { value: 'aquisicao', label: 'Aquisição' },
  { value: 'reativacao', label: 'Reativação' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'remarketing', label: 'Remarketing' },
  { value: 'branding', label: 'Branding' },
  { value: 'promocional', label: 'Promocional' },
  { value: 'sazonal', label: 'Sazonal' },
];

export default function CampanhaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'aquisicao',
    canal_id: '',
    publico_alvo: '',
    regioes: '',
    data_inicio: '',
    data_fim: '',
    orcamento_total: '',
    orcamento_diario: '',
    meta_leads: '',
    meta_conversoes: '',
    meta_cpl: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    responsavel_id: '',
    observacoes: '',
  });

  // Query: Carregar campanha para edição
  const { data: campanha, isLoading } = useQuery({
    queryKey: ['campanha-edit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campanhas')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing
  });

  // Query: Canais ativos
  const { data: canais } = useQuery({
    queryKey: ['canais-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('canais_marketing')
        .select('id, nome')
        .eq('ativo', true);
      return data;
    }
  });

  // Query: Usuários para responsável
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome')
        .order('nome');
      return data;
    }
  });

  // Preencher form ao carregar campanha
  useEffect(() => {
    if (campanha) {
      setFormData({
        nome: campanha.nome || '',
        tipo: campanha.tipo || 'aquisicao',
        canal_id: campanha.canal_id || '',
        publico_alvo: campanha.publico_alvo || '',
        regioes: campanha.regioes?.join(', ') || '',
        data_inicio: campanha.data_inicio || '',
        data_fim: campanha.data_fim || '',
        orcamento_total: campanha.orcamento_total?.toString() || '',
        orcamento_diario: campanha.orcamento_diario?.toString() || '',
        meta_leads: campanha.meta_leads?.toString() || '',
        meta_conversoes: campanha.meta_conversoes?.toString() || '',
        meta_cpl: campanha.meta_cpl?.toString() || '',
        utm_source: campanha.utm_source || '',
        utm_medium: campanha.utm_medium || '',
        utm_campaign: campanha.utm_campaign || '',
        utm_content: campanha.utm_content || '',
        utm_term: campanha.utm_term || '',
        responsavel_id: campanha.responsavel_id || '',
        observacoes: campanha.observacoes || '',
      });
    }
  }, [campanha]);

  // Gerar código automático
  const gerarCodigo = (nome: string) => {
    const prefixo = 'CMP';
    const nomeNormalizado = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 20);
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefixo}-${nomeNormalizado}-${timestamp}`;
  };

  // Mutation: Salvar campanha
  const saveMutation = useMutation({
    mutationFn: async (status?: string) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const payload = {
        nome: formData.nome,
        tipo: formData.tipo,
        canal_id: formData.canal_id || null,
        publico_alvo: formData.publico_alvo || null,
        regioes: formData.regioes ? formData.regioes.split(',').map(r => r.trim()) : null,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        orcamento_total: formData.orcamento_total ? parseFloat(formData.orcamento_total) : null,
        orcamento_diario: formData.orcamento_diario ? parseFloat(formData.orcamento_diario) : null,
        meta_leads: formData.meta_leads ? parseInt(formData.meta_leads) : null,
        meta_conversoes: formData.meta_conversoes ? parseInt(formData.meta_conversoes) : null,
        meta_cpl: formData.meta_cpl ? parseFloat(formData.meta_cpl) : null,
        utm_source: formData.utm_source || null,
        utm_medium: formData.utm_medium || null,
        utm_campaign: formData.utm_campaign || formData.nome.toLowerCase().replace(/\s+/g, '-'),
        utm_content: formData.utm_content || null,
        utm_term: formData.utm_term || null,
        responsavel_id: formData.responsavel_id || null,
        observacoes: formData.observacoes || null,
      };

      if (isEditing) {
        const { data, error } = await supabase
          .from('campanhas')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('campanhas')
          .insert({
            ...payload,
            codigo: gerarCodigo(formData.nome),
            criado_por: userData.user?.id,
            status: status || 'rascunho'
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success(isEditing ? 'Campanha atualizada!' : 'Campanha criada!');
      navigate(`/marketing/campanhas/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar campanha');
    }
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (status?: string) => {
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!formData.data_inicio) {
      toast.error('Data de início é obrigatória');
      return;
    }
    saveMutation.mutate(status);
  };

  // Preview UTM URL
  const utmPreviewUrl = () => {
    const params = new URLSearchParams();
    if (formData.utm_source) params.append('utm_source', formData.utm_source);
    if (formData.utm_medium) params.append('utm_medium', formData.utm_medium);
    if (formData.utm_campaign || formData.nome) {
      params.append('utm_campaign', formData.utm_campaign || formData.nome.toLowerCase().replace(/\s+/g, '-'));
    }
    if (formData.utm_content) params.append('utm_content', formData.utm_content);
    if (formData.utm_term) params.append('utm_term', formData.utm_term);
    const queryString = params.toString();
    return queryString ? `https://seusite.com.br/?${queryString}` : '';
  };

  if (isEditing && isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Campanha' : 'Nova Campanha'}
          </h1>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-8">
          {/* Seção: Informações Básicas */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Informações Básicas</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Campanha *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleChange('nome', e.target.value)}
                  placeholder="Ex: Black Friday 2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={formData.tipo} onValueChange={(v) => handleChange('tipo', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="canal">Canal</Label>
                <Select value={formData.canal_id} onValueChange={(v) => handleChange('canal_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {canais?.map(canal => (
                      <SelectItem key={canal.id} value={canal.id}>{canal.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="regioes">Regiões (separadas por vírgula)</Label>
                <Input
                  id="regioes"
                  value={formData.regioes}
                  onChange={(e) => handleChange('regioes', e.target.value)}
                  placeholder="Ex: SP, RJ, MG"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="publico">Público Alvo</Label>
                <Textarea
                  id="publico"
                  value={formData.publico_alvo}
                  onChange={(e) => handleChange('publico_alvo', e.target.value)}
                  placeholder="Descreva o público alvo da campanha..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Seção: Período */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Período</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data de Início *</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => handleChange('data_inicio', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_fim">Data de Término</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => handleChange('data_fim', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Seção: Orçamento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Orçamento</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orcamento_total">Orçamento Total (R$)</Label>
                <Input
                  id="orcamento_total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.orcamento_total}
                  onChange={(e) => handleChange('orcamento_total', e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orcamento_diario">Orçamento Diário (R$)</Label>
                <Input
                  id="orcamento_diario"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.orcamento_diario}
                  onChange={(e) => handleChange('orcamento_diario', e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Seção: Metas */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Metas</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="meta_leads">Meta de Leads</Label>
                <Input
                  id="meta_leads"
                  type="number"
                  min="0"
                  value={formData.meta_leads}
                  onChange={(e) => handleChange('meta_leads', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_conversoes">Meta de Conversões</Label>
                <Input
                  id="meta_conversoes"
                  type="number"
                  min="0"
                  value={formData.meta_conversoes}
                  onChange={(e) => handleChange('meta_conversoes', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_cpl">CPL Alvo (R$)</Label>
                <Input
                  id="meta_cpl"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.meta_cpl}
                  onChange={(e) => handleChange('meta_cpl', e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Seção: UTMs */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Parâmetros UTM</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="utm_source">utm_source</Label>
                <Input
                  id="utm_source"
                  value={formData.utm_source}
                  onChange={(e) => handleChange('utm_source', e.target.value)}
                  placeholder="Ex: google, facebook"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utm_medium">utm_medium</Label>
                <Input
                  id="utm_medium"
                  value={formData.utm_medium}
                  onChange={(e) => handleChange('utm_medium', e.target.value)}
                  placeholder="Ex: cpc, email, social"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utm_campaign">utm_campaign</Label>
                <Input
                  id="utm_campaign"
                  value={formData.utm_campaign}
                  onChange={(e) => handleChange('utm_campaign', e.target.value)}
                  placeholder="Auto-preenche com nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utm_content">utm_content</Label>
                <Input
                  id="utm_content"
                  value={formData.utm_content}
                  onChange={(e) => handleChange('utm_content', e.target.value)}
                  placeholder="Ex: banner_topo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utm_term">utm_term</Label>
                <Input
                  id="utm_term"
                  value={formData.utm_term}
                  onChange={(e) => handleChange('utm_term', e.target.value)}
                  placeholder="Ex: protecao veicular"
                />
              </div>
            </div>
            {utmPreviewUrl() && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Preview da URL:</p>
                <code className="text-xs break-all">{utmPreviewUrl()}</code>
              </div>
            )}
          </div>

          <Separator />

          {/* Seção: Responsável e Observações */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Responsável e Observações</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Select value={formData.responsavel_id} onValueChange={(v) => handleChange('responsavel_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios?.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Observações adicionais sobre a campanha..."
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        {!isEditing && (
          <Button 
            variant="secondary" 
            onClick={() => handleSubmit('rascunho')}
            disabled={saveMutation.isPending}
          >
            Salvar como Rascunho
          </Button>
        )}
        <Button 
          onClick={() => handleSubmit(isEditing ? undefined : 'ativa')}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {isEditing ? 'Salvar Alterações' : 'Salvar e Ativar'}
        </Button>
      </div>
    </div>
  );
}
