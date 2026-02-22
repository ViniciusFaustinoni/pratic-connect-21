import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle, Upload, FileText, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { differenceInDays } from 'date-fns';
import {
  CONCLUSAO_LAUDO_LABELS, RECOMENDACAO_LABELS,
  TIPO_DILIGENCIA_LABELS, type ConclusaoLaudo, type RecomendacaoLaudo, type TipoDiligencia,
} from '@/types/sindicancia';
import { notificarLaudoEmitido } from '@/components/sinistros/NotificacaoHelper';

interface Props {
  sindicanciaId: string;
  sinistroId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CONCLUSAO_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  regular: { border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-950/20', text: 'text-green-700 dark:text-green-400' },
  irregular_comprovada: { border: 'border-red-500', bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-700 dark:text-red-400' },
  irregular_suspeita: { border: 'border-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-400' },
  inconclusivo: { border: 'border-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/20', text: 'text-yellow-700 dark:text-yellow-400' },
};

const CONCLUSAO_DESCRICOES: Record<string, string> = {
  regular: 'A investigação não encontrou irregularidades. As evidências e informações coletadas indicam que o evento é legítimo.',
  irregular_comprovada: 'Foram encontradas evidências concretas que comprovam fraude ou irregularidade grave.',
  irregular_suspeita: 'Há indícios de irregularidade, mas as evidências não são suficientes para comprovar cabalmente.',
  inconclusivo: 'Não foi possível determinar com segurança se o evento é regular ou irregular. As evidências são insuficientes ou contraditórias.',
};

export function EmitirLaudoModal({ sindicanciaId, sinistroId, open, onOpenChange, onSuccess }: Props) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [conclusao, setConclusao] = useState('');
  const [resumo, setResumo] = useState('');
  const [irregularidades, setIrregularidades] = useState('');
  const [recomendacao, setRecomendacao] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const [diligencias, setDiligencias] = useState<any[]>([]);
  const [sindicanciaNumero, setSindicanciaNumero] = useState('');
  const [eventoProtocolo, setEventoProtocolo] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  // Fetch diligencias and sindicancia info when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      supabase.from('sindicancia_diligencias').select('*').eq('sindicancia_id', sindicanciaId).order('data_diligencia'),
      supabase.from('sindicancias').select('numero, sinistros(protocolo)').eq('id', sindicanciaId).single(),
    ]).then(([dilRes, sindRes]) => {
      setDiligencias(dilRes.data || []);
      if (sindRes.data) {
        setSindicanciaNumero(sindRes.data.numero || '');
        setEventoProtocolo((sindRes.data as any).sinistros?.protocolo || '');
      }
      setLoadingData(false);
    });
  }, [open, sindicanciaId]);

  // Reset recomendacao when conclusao changes
  useEffect(() => {
    if (conclusao === 'regular' && !['aprovar', 'encaminhar_diretoria'].includes(recomendacao)) {
      setRecomendacao('');
    }
  }, [conclusao]);

  const showIrregularidades = conclusao === 'irregular_comprovada' || conclusao === 'irregular_suspeita';

  const recomendacoesDisponiveis = useMemo(() => {
    const all = Object.entries(RECOMENDACAO_LABELS) as [RecomendacaoLaudo, string][];
    if (conclusao === 'regular') {
      return all.filter(([k]) => k === 'aprovar' || k === 'encaminhar_diretoria');
    }
    return all;
  }, [conclusao]);

  // Diligence summary
  const diligenciaSummary = useMemo(() => {
    if (diligencias.length === 0) return null;
    const countByType: Record<string, number> = {};
    diligencias.forEach(d => {
      const tipo = d.tipo as string;
      countByType[tipo] = (countByType[tipo] || 0) + 1;
    });
    const dates = diligencias.map(d => new Date(d.data_diligencia).getTime()).sort((a, b) => a - b);
    const dias = dates.length > 1 ? differenceInDays(new Date(dates[dates.length - 1]), new Date(dates[0])) : 0;
    return { total: diligencias.length, dias, countByType };
  }, [diligencias]);

  // PDF dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    onDrop: (accepted) => { if (accepted.length > 0) setPdfFile(accepted[0]); },
    onDropRejected: () => toast.error('Arquivo inválido. Apenas PDF até 10MB.'),
  });

  const canSubmit = conclusao && resumo.length >= 100 && recomendacao && confirmado
    && (!showIrregularidades || irregularidades.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);

    try {
      // 1. Upload PDF if provided
      let laudoUrl: string | null = null;
      if (pdfFile) {
        const path = `${sindicanciaId}/laudo/${Date.now()}_${pdfFile.name}`;
        const { error: upErr } = await supabase.storage.from('sindicancia-evidencias').upload(path, pdfFile);
        if (upErr) {
          toast.error('Erro ao enviar PDF');
          setSaving(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('sindicancia-evidencias').getPublicUrl(path);
        laudoUrl = urlData?.publicUrl || null;
      }

      // 2. Update sindicancia
      const { error: sindError } = await supabase
        .from('sindicancias')
        .update({
          laudo_conclusao: conclusao,
          laudo_resumo: resumo,
          laudo_irregularidades: showIrregularidades ? irregularidades : null,
          laudo_recomendacao: recomendacao,
          laudo_arquivo_url: laudoUrl,
          data_laudo: new Date().toISOString(),
          status: 'laudo_emitido',
        })
        .eq('id', sindicanciaId);

      if (sindError) throw sindError;

      // 3. Update sinistro status
      await supabase.from('sinistros').update({ status: 'aguardando_analise' }).eq('id', sinistroId);

      // 4. Insert historico
      const conclusaoLabel = CONCLUSAO_LAUDO_LABELS[conclusao as ConclusaoLaudo] || conclusao;
      const recomendacaoLabel = RECOMENDACAO_LABELS[recomendacao as RecomendacaoLaudo] || recomendacao;

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        observacao: `Laudo de sindicância emitido — Conclusão: ${conclusaoLabel} — Recomendação: ${recomendacaoLabel}`,
        status_novo: 'aguardando_analise',
        status_anterior: 'em_sindicancia',
        usuario_id: profile?.id || null,
      });

      // 5. Notify analysts
      await notificarLaudoEmitido(sinistroId, eventoProtocolo, conclusaoLabel, sindicanciaNumero);

      // 6. Success
      toast.success('Laudo emitido com sucesso. O caso foi devolvido ao analista da Pratic Car.');
      onOpenChange(false);
      onSuccess();

      // 7. Redirect to dashboard
      navigate('/sindicante');
    } catch (err) {
      console.error('[EmitirLaudo] Erro:', err);
      toast.error('Erro ao emitir laudo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir Laudo — {sindicanciaNumero || '...'}</DialogTitle>
          <DialogDescription>Evento #{eventoProtocolo || '...'}</DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Seção 1: Conclusão */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">1. Conclusão *</Label>
              <RadioGroup value={conclusao} onValueChange={setConclusao} className="space-y-2">
                {Object.entries(CONCLUSAO_LAUDO_LABELS).map(([value, label]) => {
                  const colors = CONCLUSAO_COLORS[value];
                  const selected = conclusao === value;
                  return (
                    <label
                      key={value}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selected ? `${colors.border} ${colors.bg}` : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <RadioGroupItem value={value} className="mt-0.5" />
                      <div className="flex-1">
                        <span className={`font-medium text-sm ${selected ? colors.text : ''}`}>{label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{CONCLUSAO_DESCRICOES[value]}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Seção 2: Resumo Executivo */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">2. Resumo da Investigação *</Label>
              <Textarea
                placeholder="Descreva de forma objetiva: o que foi investigado, quais foram os principais achados, e como chegou à conclusão acima. Escreva em 2-3 parágrafos, como se estivesse explicando para alguém que não acompanhou a investigação..."
                value={resumo}
                onChange={e => setResumo(e.target.value)}
                rows={6}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Este resumo será lido pelo analista da Pratic para tomar a decisão sobre o evento.</span>
                <span className={resumo.length < 100 ? 'text-destructive' : ''}>{resumo.length}/100 min</span>
              </div>
            </div>

            {/* Seção 3: Irregularidades (condicional) */}
            {showIrregularidades && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">3. Detalhamento das Irregularidades *</Label>
                <Textarea
                  placeholder="Descreva cada irregularidade encontrada. Cite as evidências que sustentam cada achado. Faça referência às diligências realizadas..."
                  value={irregularidades}
                  onChange={e => setIrregularidades(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* Seção 4: Recomendação */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{showIrregularidades ? '4' : '3'}. Recomendação *</Label>
              <Select value={recomendacao} onValueChange={setRecomendacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a recomendação" />
                </SelectTrigger>
                <SelectContent>
                  {recomendacoesDisponiveis.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {conclusao === 'regular' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Para conclusão "Regular", apenas "Aprovar" e "Encaminhar para a Diretoria" estão disponíveis.
                </p>
              )}
            </div>

            {/* Seção 5: Upload PDF */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{showIrregularidades ? '5' : '4'}. Laudo Formal em PDF (opcional)</Label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <input {...getInputProps()} />
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">{pdfFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setPdfFile(null); }}>Remover</Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Arraste o PDF aqui ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground">Máximo 10MB</p>
                  </div>
                )}
              </div>
              {!pdfFile && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Recomendamos anexar o laudo formal assinado em PDF para documentação completa do caso.
                  </p>
                </div>
              )}
            </div>

            {/* Seção 6: Resumo de Diligências */}
            {diligenciaSummary && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Resumo das Diligências Realizadas
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Foram realizadas <strong>{diligenciaSummary.total}</strong> diligência(s)
                    {diligenciaSummary.dias > 0 && <> ao longo de <strong>{diligenciaSummary.dias}</strong> dia(s)</>}:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-0.5 ml-4">
                    {Object.entries(diligenciaSummary.countByType).map(([tipo, count]) => (
                      <li key={tipo}>• {count} {TIPO_DILIGENCIA_LABELS[tipo as TipoDiligencia] || tipo}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Seção 7: Confirmação Final */}
            <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/10">
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>ATENÇÃO:</strong> Após emitir o laudo, você não poderá mais editá-lo ou registrar novas diligências neste caso. O caso será devolvido ao analista da Pratic Car para decisão final.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="confirmar-laudo"
                    checked={confirmado}
                    onCheckedChange={(checked) => setConfirmado(checked === true)}
                  />
                  <label htmlFor="confirmar-laudo" className="text-sm cursor-pointer">
                    Confirmo que as informações do laudo estão corretas e completas
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Botões */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Emitir Laudo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
