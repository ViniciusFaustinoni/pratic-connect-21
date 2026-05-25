import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageCircle, AlertCircle } from 'lucide-react';
import {
  parseVariaveisTemplate,
  sugerirMappingInicial,
  renderPreview,
  validarMapping,
  VAR_SOURCE_LABELS,
  type VarSource,
  type VarMapping,
  type DestinatarioPreview,
} from '@/lib/cobranca/templateVarsMapper';

interface TemplateRow {
  id: string;
  nome: string;
  categoria: string | null;
  corpo: string | null;
  header_tipo: string | null;
  header_texto: string | null;
  botoes: any;
  variaveis_exemplo: any;
}

interface Props {
  templateNome: string;
  onTemplateNomeChange: (v: string) => void;
  mapping: VarMapping;
  onMappingChange: (m: VarMapping) => void;
  usarBotaoUrl: boolean;
  onUsarBotaoUrlChange: (v: boolean) => void;
  previewDestinatario?: DestinatarioPreview | null;
  onValidationChange?: (ok: boolean) => void;
}

const SOURCES: VarSource[] = [
  'primeiro_nome', 'nome', 'matricula',
  'valor_total', 'lista_boletos',
  'placa_primeira', 'vencimento_primeiro',
  'linha_digitavel_primeira', 'valor_primeiro_boleto',
  'qtd_boletos', 'texto_fixo',
];

export function TemplateMetaPicker({
  templateNome, onTemplateNomeChange,
  mapping, onMappingChange,
  usarBotaoUrl, onUsarBotaoUrlChange,
  previewDestinatario,
  onValidationChange,
}: Props) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['whatsapp-templates-cobranca-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_meta_templates')
        .select('id, nome, categoria, corpo, header_tipo, header_texto, botoes, variaveis_exemplo, status, disparo_habilitado')
        .eq('status', 'APPROVED')
        .eq('disparo_habilitado', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as unknown as TemplateRow[];
    },
    staleTime: 5 * 60_000,
  });

  const tpl = useMemo(
    () => templates.find((t) => t.nome === templateNome) || null,
    [templates, templateNome],
  );

  const vars = useMemo(
    () => parseVariaveisTemplate(tpl?.corpo, tpl?.header_tipo === 'text' ? tpl?.header_texto : null),
    [tpl],
  );

  // Detecta se o template tem botão URL dinâmico (com {{1}} no url)
  const temBotaoUrlDinamico = useMemo(() => {
    const bts = tpl?.botoes;
    if (!Array.isArray(bts)) return false;
    return bts.some((b: any) => {
      const t = (b?.type || b?.tipo || '').toString().toUpperCase();
      const url = b?.url || b?.URL || '';
      return t === 'URL' && /\{\{\s*\d+\s*\}\}/.test(url);
    });
  }, [tpl]);

  // Quando muda o template, sugere mapping novo
  useEffect(() => {
    if (!tpl) return;
    onMappingChange(sugerirMappingInicial(tpl.nome, vars));
    // Se não tem botão URL dinâmico, força desligado
    if (!temBotaoUrlDinamico && usarBotaoUrl) onUsarBotaoUrlChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl?.id]);

  const validacao = useMemo(() => validarMapping(vars, mapping), [vars, mapping]);
  useEffect(() => {
    onValidationChange?.(validacao.ok);
  }, [validacao.ok, onValidationChange]);

  const preview = useMemo(() => {
    if (!tpl?.corpo || !previewDestinatario) return '';
    return renderPreview(tpl.corpo, mapping, previewDestinatario);
  }, [tpl, mapping, previewDestinatario]);

  function setEntry(k: string, patch: Partial<{ source: VarSource; texto: string }>) {
    const novo: VarMapping = { ...mapping };
    const atual = novo[k] || { source: 'texto_fixo' as VarSource };
    novo[k] = { ...atual, ...patch } as any;
    onMappingChange(novo);
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h4 className="font-semibold">Template Meta</h4>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Template aprovado</Label>
          <Select value={templateNome} onValueChange={onTemplateNomeChange} disabled={isLoading}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione o template'} />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.nome}>
                  <span className="font-mono text-xs">{t.nome}</span>
                  <span className="ml-2 text-muted-foreground text-xs">({t.categoria || '—'})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {temBotaoUrlDinamico && (
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={usarBotaoUrl} onCheckedChange={onUsarBotaoUrlChange} />
              <Label className="text-xs">Usar botão URL dinâmico (link 2ª via)</Label>
            </div>
          </div>
        )}
      </div>

      {tpl && (
        <div className="rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
          {tpl.header_tipo === 'text' && tpl.header_texto && (
            <div className="font-bold mb-2">{tpl.header_texto}</div>
          )}
          {tpl.corpo}
        </div>
      )}

      {vars.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Mapeamento das variáveis</Label>
          {vars.map((k) => {
            const e = mapping[k];
            const exemplo = tpl?.variaveis_exemplo?.[k];
            return (
              <div key={k} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                <code className="text-xs px-2 py-1 bg-muted rounded text-center">{`{{${k}}}`}</code>
                <Select
                  value={e?.source || ''}
                  onValueChange={(v) => setEntry(k, { source: v as VarSource })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{VAR_SOURCE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {e?.source === 'texto_fixo' ? (
                  <Input
                    placeholder="Texto literal"
                    value={e.texto || ''}
                    onChange={(ev) => setEntry(k, { texto: ev.target.value })}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground truncate" title={exemplo ? String(exemplo) : ''}>
                    {exemplo ? <>ex.: <em>{String(exemplo)}</em></> : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!validacao.ok && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Variáveis sem mapeamento válido: {validacao.faltando.map((v) => `{{${v}}}`).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {preview && previewDestinatario && (
        <div className="space-y-1">
          <Label className="text-xs">Pré-visualização (1º destinatário: {previewDestinatario.nome})</Label>
          <div className="rounded border bg-background p-3 text-sm whitespace-pre-wrap">
            {preview}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando templates...
        </div>
      )}
    </Card>
  );
}
