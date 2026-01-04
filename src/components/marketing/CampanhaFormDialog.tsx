import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCampanha, useUpdateCampanha, useCanais, Campanha } from '@/hooks/useMarketing';

interface CampanhaFormDialogProps {
  open: boolean;
  onClose: () => void;
  campanha?: Campanha | null;
}

const tipos = [
  { value: 'aquisicao', label: 'Aquisição' },
  { value: 'reativacao', label: 'Reativação' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'branding', label: 'Branding' },
  { value: 'promocional', label: 'Promocional' },
  { value: 'sazonal', label: 'Sazonal' },
  { value: 'remarketing', label: 'Remarketing' },
];

export function CampanhaFormDialog({ open, onClose, campanha }: CampanhaFormDialogProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('aquisicao');
  const [canalId, setCanalId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [orcamentoTotal, setOrcamentoTotal] = useState('');
  const [metaLeads, setMetaLeads] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: canais } = useCanais();
  const createMutation = useCreateCampanha();
  const updateMutation = useUpdateCampanha();

  const isEditing = !!campanha;

  useEffect(() => {
    if (campanha) {
      setNome(campanha.nome);
      setTipo(campanha.tipo);
      setCanalId(campanha.canal_id || '');
      setDataInicio(campanha.data_inicio);
      setDataFim(campanha.data_fim || '');
      setOrcamentoTotal(campanha.orcamento_total?.toString() || '');
      setMetaLeads(campanha.meta_leads?.toString() || '');
      setUtmSource(campanha.utm_source || '');
      setUtmMedium(campanha.utm_medium || '');
      setUtmCampaign(campanha.utm_campaign || '');
      setObservacoes(campanha.observacoes || '');
    } else {
      resetForm();
    }
  }, [campanha, open]);

  const resetForm = () => {
    setNome('');
    setTipo('aquisicao');
    setCanalId('');
    setDataInicio('');
    setDataFim('');
    setOrcamentoTotal('');
    setMetaLeads('');
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setObservacoes('');
  };

  const handleSubmit = () => {
    const data = {
      nome,
      tipo,
      canal_id: canalId || null,
      data_inicio: dataInicio,
      data_fim: dataFim || null,
      orcamento_total: orcamentoTotal ? parseFloat(orcamentoTotal) : null,
      meta_leads: metaLeads ? parseInt(metaLeads) : null,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      observacoes: observacoes || null,
    };

    if (isEditing) {
      updateMutation.mutate({ id: campanha.id, ...data }, {
        onSuccess: () => onClose(),
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => onClose(),
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Campanha' : 'Nova Campanha'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome da Campanha *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Black Friday 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="canal">Canal</Label>
              <Select value={canalId} onValueChange={setCanalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {canais?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data de Início *</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataFim">Data de Término</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orcamento">Orçamento Total (R$)</Label>
              <Input
                id="orcamento"
                type="number"
                step="0.01"
                value={orcamentoTotal}
                onChange={(e) => setOrcamentoTotal(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metaLeads">Meta de Leads</Label>
              <Input
                id="metaLeads"
                type="number"
                value={metaLeads}
                onChange={(e) => setMetaLeads(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Parâmetros UTM</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="utmSource">Source</Label>
                <Input
                  id="utmSource"
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  placeholder="google, facebook..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utmMedium">Medium</Label>
                <Input
                  id="utmMedium"
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  placeholder="cpc, email..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utmCampaign">Campaign</Label>
                <Input
                  id="utmCampaign"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder="black-friday..."
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações sobre a campanha..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !nome || !dataInicio}
          >
            {isEditing ? 'Salvar' : 'Criar Campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
