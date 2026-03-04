import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Loader2, ArrowRight, Camera, X, AlertTriangle, FileUp, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';

const ETAPAS_REPARO = [
  { id: 'lanternagem', nome: 'Lanternagem', descricao: 'Chaparia e estrutura da carroceria' },
  { id: 'pintura', nome: 'Pintura', descricao: 'Aplicação de primer, tinta e verniz' },
  { id: 'mecanica', nome: 'Mecânica', descricao: 'Reparos no motor, câmbio, suspensão' },
  { id: 'eletrica', nome: 'Elétrica', descricao: 'Fiação, módulos, sensores, faróis' },
  { id: 'vidros_farois', nome: 'Vidros e Faróis', descricao: 'Troca ou reparo de para-brisa, vidros laterais, traseiro e faróis' },
  { id: 'polimento', nome: 'Polimento', descricao: 'Acabamento final da pintura' },
  { id: 'lavagem', nome: 'Lavagem', descricao: 'Limpeza completa antes da entrega' },
] as const;

interface ItemParecer {
  tipo: 'peca' | 'servico';
  descricao: string;
  origem_sugerida?: string;
  quantidade: number;
  valor_estimado: number;
  prioridade: 'essencial' | 'necessario' | 'opcional';
  observacao?: string;
}

interface FotoTecnica {
  file: File;
  preview: string;
  descricao: string;
}

interface VistoriaEventoOrcamentoProps {
  open: boolean;
  onClose: () => void;
  vistoriaId: string;
  sinistroId: string;
  valorFipe: number | null;
  veiculo?: { marca?: string; modelo?: string; ano_modelo?: string | number } | null;
}

export function VistoriaEventoOrcamento({
  open,
  onClose,
  vistoriaId,
  sinistroId,
  valorFipe,
  veiculo,
}: VistoriaEventoOrcamentoProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seção 1: Avaliação Geral
  const [gravidade, setGravidade] = useState<string>('');
  const [descricaoTecnica, setDescricaoTecnica] = useState('');
  const [fotos, setFotos] = useState<FotoTecnica[]>([]);

  // Seção 2: Itens
  const [itens, setItens] = useState<ItemParecer[]>([]);
  const [etapasReparo, setEtapasReparo] = useState<string[]>([]);

  // PDF Import
  const [pdfImporting, setPdfImporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string>('');
  const [pdfImported, setPdfImported] = useState(false);

  const handlePdfDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      return;
    }

    setPdfImporting(true);
    setPdfProgress('Enviando PDF...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      // Upload to storage
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `orcamentos-pdf/${timestamp}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from('documentos')
        .upload(path, file, { contentType: 'application/pdf' });
      if (uploadErr) throw new Error(`Erro no upload: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);
      const pdfUrl = urlData.publicUrl;

      setPdfProgress('Extraindo itens com IA...');

      // Call extract edge function
      const res = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/extract-orcamento-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pdfUrl }),
        }
      );

      if (res.status === 429) {
        toast.error('Limite de requisições excedido. Tente novamente em alguns segundos.');
        return;
      }
      if (res.status === 402) {
        toast.error('Créditos de IA insuficientes.');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao extrair dados do PDF');
      }

      const extracted = await res.json();

      // Convert to ItemParecer[]
      const novosItens: ItemParecer[] = [];

      if (extracted.pecas?.length) {
        for (const p of extracted.pecas) {
          novosItens.push({
            tipo: 'peca',
            descricao: p.descricao || '',
            origem_sugerida: p.origem || 'qualquer',
            quantidade: p.quantidade || 1,
            valor_estimado: p.valor_unitario || 0,
            prioridade: 'necessario',
            observacao: p.operacao === 'R&I' ? 'R&I - Remover e Instalar' : (p.operacao ? `Operação: ${p.operacao}` : ''),
          });
        }
      }

      if (extracted.servicos?.length) {
        for (const s of extracted.servicos) {
          novosItens.push({
            tipo: 'servico',
            descricao: s.descricao || '',
            quantidade: 1,
            valor_estimado: s.valor_total || 0,
            prioridade: 'necessario',
            observacao: s.tipo_servico || '',
          });
        }
      }

      if (novosItens.length === 0) {
        toast.warning('Nenhum item encontrado no PDF. Verifique o documento.');
        return;
      }

      setItens(prev => [...prev, ...novosItens]);
      setPdfImported(true);
      toast.success(`${novosItens.length} itens extraídos do PDF com sucesso!`);
    } catch (err: any) {
      console.error('PDF import error:', err);
      toast.error(err.message || 'Erro ao importar PDF');
    } finally {
      setPdfImporting(false);
      setPdfProgress('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handlePdfDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: pdfImporting,
  });

  // Seção 3: Prazo
  const [prazoEstimado, setPrazoEstimado] = useState('');
  const [prazoObservacao, setPrazoObservacao] = useState('');

  // Seção 4: Observações
  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [recomendacao, setRecomendacao] = useState('');

  const totalPecas = itens.filter(i => i.tipo === 'peca').reduce((s, i) => s + i.valor_estimado * i.quantidade, 0);
  const totalServicos = itens.filter(i => i.tipo === 'servico').reduce((s, i) => s + i.valor_estimado * i.quantidade, 0);
  const totalGeral = totalPecas + totalServicos;
  const pctFipe = valorFipe && valorFipe > 0 ? (totalGeral / valorFipe) * 100 : 0;
  const alertaFipe = pctFipe > 75;

  const adicionarItem = (tipo: 'peca' | 'servico') => {
    setItens(prev => [...prev, {
      tipo,
      descricao: '',
      origem_sugerida: tipo === 'peca' ? 'qualquer' : undefined,
      quantidade: 1,
      valor_estimado: 0,
      prioridade: 'necessario',
      observacao: '',
    }]);
  };

  const updateItem = (idx: number, field: keyof ItemParecer, value: any) => {
    setItens(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removerItem = (idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFotos: FotoTecnica[] = [];
    for (let i = 0; i < files.length && fotos.length + newFotos.length < 20; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} excede 5MB`);
        continue;
      }
      newFotos.push({ file, preview: URL.createObjectURL(file), descricao: '' });
    }
    setFotos(prev => [...prev, ...newFotos]);
    e.target.value = '';
  };

  const removerFoto = (idx: number) => {
    setFotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleFinalizar = async () => {
    if (!gravidade) { toast.error('Selecione a gravidade do dano'); return; }
    if (descricaoTecnica.length < 50) { toast.error('Descrição técnica deve ter pelo menos 50 caracteres'); return; }
    if (fotos.length < 3) { toast.error('Envie pelo menos 3 fotos técnicas'); return; }
    if (!recomendacao) { toast.error('Selecione a recomendação'); return; }
    if (gravidade !== 'possivel_perda_total' && itens.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    if (gravidade !== 'possivel_perda_total' && etapasReparo.length === 0) { toast.error('Selecione pelo menos uma etapa de reparo'); return; }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const dados = {
        gravidade,
        descricao_tecnica: descricaoTecnica,
        prazo_estimado: prazoEstimado || null,
        prazo_observacao: prazoObservacao || null,
        observacoes_gerais: observacoesGerais || null,
        recomendacao,
        estimativa_total: totalGeral,
        itens_parecer: itens,
        etapas_reparo: gravidade !== 'possivel_perda_total'
          ? ETAPAS_REPARO
              .filter(e => etapasReparo.includes(e.id))
              .map(e => ({ id: e.id, nome: e.nome, selecionada: true, status: 'pendente' as const }))
          : [],
        // Legacy compatibility
        tipo_dano: gravidade === 'possivel_perda_total' ? 'total' : 'parcial',
        parecer_tecnico: descricaoTecnica,
        itens_orcamento: itens.map(i => ({
          descricao: i.descricao,
          tipo: i.tipo === 'peca' ? 'peca' : 'servico',
          valor_unitario: i.valor_estimado,
          quantidade: i.quantidade,
          valor_total: i.valor_estimado * i.quantidade,
        })),
        valor_total_orcamento: totalGeral,
      };

      // Upload fotos first
      for (let i = 0; i < fotos.length; i++) {
        const formData = new FormData();
        formData.append('acao', 'salvar_midias');
        formData.append('vistoria_id', vistoriaId);
        formData.append('tipo', 'foto');
        formData.append('index', String(i + 1));
        formData.append('arquivo', fotos[i].file);

        await fetch(
          `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/salvar-vistoria-regulador`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          }
        );
      }

      // Finalizar
      const formData = new FormData();
      formData.append('acao', 'finalizar');
      formData.append('vistoria_id', vistoriaId);
      formData.append('dados', JSON.stringify(dados));

      const res = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/salvar-vistoria-regulador`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao finalizar');
      }

      toast.success('Parecer técnico registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['vistorias-evento'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-evento-contadores'] });
      queryClient.invalidateQueries({ queryKey: ['parecer-tecnico'] });
      navigate('/regulador/vistorias');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao finalizar vistoria');
    } finally {
      setSaving(false);
    }
  };

  const pecas = itens.filter(i => i.tipo === 'peca');
  const servicos = itens.filter(i => i.tipo === 'servico');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-full max-h-full sm:max-w-2xl sm:max-h-[90vh] sm:h-auto p-0 gap-0 rounded-none sm:rounded-lg">
        <DialogHeader className="px-4 pt-4 pb-2 border-b sticky top-0 bg-background z-10">
          <DialogTitle>Parecer Técnico — Regulagem</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto p-4 space-y-6 flex-1">
          {/* ====== SEÇÃO 1: Avaliação Geral ====== */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">1. Avaliação Geral do Dano</h3>

            <div className="space-y-1">
              <Label className="text-xs">Gravidade do dano *</Label>
              <Select value={gravidade} onValueChange={setGravidade}>
                <SelectTrigger><SelectValue placeholder="Selecione a gravidade..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Leve — arranhões, amassados pequenos</SelectItem>
                  <SelectItem value="moderado">Moderado — peças a trocar, funilaria necessária</SelectItem>
                  <SelectItem value="grave">Grave — múltiplas peças, danos estruturais</SelectItem>
                  <SelectItem value="possivel_perda_total">Possível Perda Total — dano extenso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição técnica dos danos * (mín. 50 caracteres)</Label>
              <Textarea
                value={descricaoTecnica}
                onChange={(e) => setDescricaoTecnica(e.target.value)}
                placeholder="Descreva tecnicamente os danos encontrados, áreas afetadas, estado geral do veículo..."
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">{descricaoTecnica.length}/50 caracteres mínimos</p>
            </div>

            {/* Fotos técnicas */}
            <div className="space-y-1">
              <Label className="text-xs">Fotos técnicas * (mín. 3, máx. 20)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={handleFotoUpload}
              />
              <div className="grid grid-cols-4 gap-2">
                {fotos.map((foto, i) => (
                  <div key={i} className="relative aspect-square rounded border overflow-hidden group">
                    <img src={foto.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removerFoto(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {fotos.length < 20 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px]">{fotos.length}/20</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ====== SEÇÃO 2: Itens ====== */}
          {gravidade && gravidade !== 'possivel_perda_total' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">2. Itens Necessários (Estimativa)</h3>
              <p className="text-xs text-muted-foreground">
                Valores estimados com base na sua experiência. O orçamento final será feito pelo analista com a oficina.
              </p>

              {/* Etapas do Reparo */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Etapas necessárias *</Label>
                {ETAPAS_REPARO.map((etapa) => (
                  <label key={etapa.id} className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={etapasReparo.includes(etapa.id)}
                      onCheckedChange={(checked) => {
                        setEtapasReparo(prev => checked ? [...prev, etapa.id] : prev.filter(id => id !== etapa.id));
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{etapa.nome}</span>
                      <p className="text-[10px] text-muted-foreground">{etapa.descricao}</p>
                    </div>
                  </label>
                ))}
              </div>

              {etapasReparo.length > 0 && (
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Sequência:</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {ETAPAS_REPARO.filter(e => etapasReparo.includes(e.id)).map((etapa, i, arr) => (
                      <span key={etapa.id} className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">{etapa.nome}</Badge>
                        {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF Import Zone */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Importar orçamento via PDF</Label>
                {pdfImporting ? (
                  <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-sm font-medium text-foreground">{pdfProgress}</p>
                    <Progress value={pdfProgress.includes('Extraindo') ? 66 : 33} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">Isso pode levar alguns segundos...</p>
                  </div>
                ) : pdfImported ? (
                  <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 p-3 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-green-800 dark:text-green-300">PDF importado com sucesso!</p>
                      <p className="text-[10px] text-green-700 dark:text-green-400">Revise e ajuste os itens abaixo se necessário.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7"
                      {...getRootProps()}
                    >
                      <input {...getInputProps()} />
                      Reimportar
                    </Button>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <FileUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      {isDragActive ? 'Solte o PDF aqui' : 'Arraste o PDF do orçamento aqui'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      ou clique para selecionar • A IA extrairá peças, serviços e valores automaticamente
                    </p>
                  </div>
                )}
              </div>

              {/* Itens list */}
              {itens.map((item, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <Badge variant={item.tipo === 'peca' ? 'default' : 'secondary'} className="text-[10px]">
                      {item.tipo === 'peca' ? '🔧 Peça' : '🛠️ Serviço'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removerItem(i)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>

                  <Input
                    placeholder={item.tipo === 'peca' ? 'Ex: Para-choque dianteiro, Farol esquerdo...' : 'Ex: Funilaria lateral, Pintura parcial...'}
                    value={item.descricao}
                    onChange={(e) => updateItem(i, 'descricao', e.target.value)}
                    className="text-sm"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    {item.tipo === 'peca' && (
                      <div className="space-y-1">
                        <Label className="text-[10px]">Origem sugerida</Label>
                        <Select value={item.origem_sugerida || 'qualquer'} onValueChange={(v) => updateItem(i, 'origem_sugerida', v)}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="original">Original</SelectItem>
                            <SelectItem value="seminova">Seminova</SelectItem>
                            <SelectItem value="paralela">Paralela</SelectItem>
                            <SelectItem value="qualquer">Qualquer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Prioridade</Label>
                      <Select value={item.prioridade} onValueChange={(v) => updateItem(i, 'prioridade', v as any)}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="essencial">Essencial</SelectItem>
                          <SelectItem value="necessario">Necessário</SelectItem>
                          <SelectItem value="opcional">Opcional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Valor estimado (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.valor_estimado || ''}
                        onChange={(e) => updateItem(i, 'valor_estimado', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade || ''}
                        onChange={(e) => updateItem(i, 'quantidade', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Total</Label>
                      <Input
                        value={`R$ ${(item.valor_estimado * item.quantidade).toFixed(2)}`}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Observação técnica (opcional)</Label>
                    <Input
                      placeholder="Ex: Peça original só em SP — prazo pode ser maior"
                      value={item.observacao || ''}
                      onChange={(e) => updateItem(i, 'observacao', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => adicionarItem('peca')} className="flex-1 gap-1">
                  <Plus className="h-3 w-3" /> Peça
                </Button>
                <Button variant="outline" size="sm" onClick={() => adicionarItem('servico')} className="flex-1 gap-1">
                  <Plus className="h-3 w-3" /> Serviço
                </Button>
              </div>

              {/* Resumo de itens */}
              {itens.length > 0 && (
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <div className="flex justify-between text-xs">
                    <span>Peças ({pecas.length}):</span>
                    <span>R$ {totalPecas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Serviços ({servicos.length}):</span>
                    <span>R$ {totalServicos.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>ESTIMATIVA TOTAL:</span>
                    <span>R$ {totalGeral.toFixed(2)}</span>
                  </div>
                  {valorFipe && valorFipe > 0 && (
                    <div className={`flex justify-between text-xs ${alertaFipe ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      <span>FIPE: R$ {valorFipe.toFixed(0)}</span>
                      <span>{pctFipe.toFixed(1)}% da FIPE</span>
                    </div>
                  )}
                </div>
              )}

              {alertaFipe && (
                <div className="flex items-start gap-2 p-2 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>⚠️ A estimativa ultrapassa 75% da FIPE. Pode configurar Perda Total. O analista será notificado.</span>
                </div>
              )}
            </section>
          )}

          {/* Perda Total banner */}
          {gravidade === 'possivel_perda_total' && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 space-y-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">⚠️ Possível Perda Total</p>
              <p className="text-xs text-red-700 dark:text-red-400">
                A avaliação indica que o dano pode configurar perda total. O analista e o diretor serão notificados.
              </p>
            </div>
          )}

          {/* ====== SEÇÃO 3: Prazo ====== */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">3. Prazo Estimado</h3>
            <div className="space-y-1">
              <Label className="text-xs">Tempo estimado de reparo</Label>
              <Select value={prazoEstimado} onValueChange={setPrazoEstimado}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ate_5_dias">Até 5 dias úteis</SelectItem>
                  <SelectItem value="5_a_15">5 a 15 dias úteis</SelectItem>
                  <SelectItem value="15_a_30">15 a 30 dias úteis</SelectItem>
                  <SelectItem value="30_a_60">30 a 60 dias úteis</SelectItem>
                  <SelectItem value="mais_60">Mais de 60 dias úteis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação sobre prazo (opcional)</Label>
              <Input
                value={prazoObservacao}
                onChange={(e) => setPrazoObservacao(e.target.value)}
                placeholder="Ex: Depende da disponibilidade de peça importada"
              />
            </div>
          </section>

          {/* ====== SEÇÃO 4: Observações ====== */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">4. Observações e Recomendação</h3>
            <div className="space-y-1">
              <Label className="text-xs">Observações gerais (opcional)</Label>
              <Textarea
                value={observacoesGerais}
                onChange={(e) => setObservacoesGerais(e.target.value)}
                placeholder="Ex: Recomendo oficina X por ter experiência com esta marca..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recomendação *</Label>
              <Select value={recomendacao} onValueChange={setRecomendacao}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seguir_reparo">Seguir com reparo normalmente</SelectItem>
                  <SelectItem value="segunda_avaliacao">Solicitar segunda avaliação</SelectItem>
                  <SelectItem value="avaliar_perda_total">Avaliar possibilidade de Perda Total</SelectItem>
                  <SelectItem value="pericia_tecnica">Encaminhar para perícia técnica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        {/* Footer fixo */}
        <div className="border-t p-4 sticky bottom-0 bg-background">
          <Button
            className="w-full"
            size="lg"
            onClick={handleFinalizar}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Finalizando...
              </>
            ) : (
              'Registrar Parecer Técnico'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
