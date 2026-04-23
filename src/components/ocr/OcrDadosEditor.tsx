import { useEffect, useMemo, useState } from 'react';
import { Pencil, Save, X, AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CpfInput, PlacaInput, CepInput, CnpjInput, TelefoneInput } from '@/components/inputs/MaskedInputs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getSchemaForTipo,
  OCR_TIPO_LABEL,
  type OcrFieldDef,
  type OcrSchemaTipo,
} from './ocr-fields-schema';

export interface OcrDadosEditorProps {
  /** Dados extraídos pelo OCR (chave/valor). */
  dados: Record<string, unknown> | null | undefined;
  /** Tipo do documento (define quais campos exibir). */
  tipoDocumento: string | null | undefined;
  /** Confiança do OCR (0..1). */
  confianca?: number | null;
  /** Sugestão do OCR. */
  sugestao?: 'aprovar' | 'reprovar' | 'revisar' | null;
  /** Indica se OCR conseguiu ler — se false, abre em modo edição automaticamente. */
  legivel?: boolean;
  /** Callback ao salvar. Recebe os dados editados (apenas chaves do schema). */
  onSave: (dadosEditados: Record<string, string>) => void | Promise<void>;
  /** Quando true, o card já abre expandido em modo edição. */
  forceEdit?: boolean;
  /** Esconde o título (útil quando o card pai já tem cabeçalho). */
  hideHeader?: boolean;
  /** Classes extras. */
  className?: string;
}

/**
 * Editor universal de dados extraídos por OCR.
 *
 * - Renderiza campos editáveis dinamicamente conforme `tipoDocumento`.
 * - Permite preenchimento manual quando OCR falha.
 * - Não toca no arquivo anexado — apenas nos campos extraídos.
 */
export function OcrDadosEditor({
  dados,
  tipoDocumento,
  confianca,
  sugestao,
  legivel,
  onSave,
  forceEdit = false,
  hideHeader = false,
  className,
}: OcrDadosEditorProps) {
  const schema = useMemo(() => getSchemaForTipo(tipoDocumento), [tipoDocumento]);
  const tipoLabel = tipoDocumento ? (OCR_TIPO_LABEL[tipoDocumento as OcrSchemaTipo] || 'Documento') : 'Documento';

  // OCR considerado falho → abre direto em edição manual
  const ocrFalhou = legivel === false || sugestao === 'reprovar';
  const ocrPedeRevisao = sugestao === 'revisar';

  const initialValues = useMemo(() => {
    const out: Record<string, string> = {};
    if (dados) {
      for (const f of schema) {
        const raw = (dados as Record<string, unknown>)[f.key];
        out[f.key] = raw == null ? '' : String(raw);
      }
    } else {
      for (const f of schema) out[f.key] = '';
    }
    return out;
  }, [dados, schema]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [editing, setEditing] = useState<boolean>(forceEdit || ocrFalhou);
  const [saving, setSaving] = useState(false);

  // Re-sincroniza quando dados/schema mudam externamente
  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (forceEdit || ocrFalhou) setEditing(true);
  }, [forceEdit, ocrFalhou]);

  if (schema.length === 0) {
    // Tipo sem schema — nada para editar
    return null;
  }

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleCancel = () => {
    setValues(initialValues);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Trim em todos os campos
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        cleaned[k] = typeof v === 'string' ? v.trim() : v;
      }
      await onSave(cleaned);
      setEditing(false);
      toast.success('Dados atualizados');
    } catch (err) {
      console.error('[OcrDadosEditor] erro ao salvar:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar dados');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: OcrFieldDef) => {
    const value = values[field.key] ?? '';
    const commonProps = {
      id: `ocr-${field.key}`,
      disabled: !editing || saving,
    };

    if (field.type === 'select' && field.options) {
      return (
        <Select
          value={value || undefined}
          onValueChange={(v) => handleChange(field.key, v)}
          disabled={!editing || saving}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={field.placeholder || 'Selecione...'} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.mask === 'cpf') {
      return (
        <CpfInput
          {...commonProps}
          value={value}
          onChange={(v) => handleChange(field.key, v)}
        />
      );
    }
    if (field.mask === 'placa') {
      return (
        <PlacaInput
          {...commonProps}
          value={value}
          onChange={(v) => handleChange(field.key, v)}
        />
      );
    }
    if (field.mask === 'cep') {
      return (
        <CepInput
          {...commonProps}
          value={value}
          onChange={(v) => handleChange(field.key, v)}
        />
      );
    }
    if (field.mask === 'cnpj') {
      return (
        <CnpjInput
          {...commonProps}
          value={value}
          onChange={(v) => handleChange(field.key, v)}
        />
      );
    }
    if (field.mask === 'telefone') {
      return (
        <TelefoneInput
          {...commonProps}
          value={value}
          onChange={(v) => handleChange(field.key, v)}
        />
      );
    }

    return (
      <Input
        {...commonProps}
        type={field.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) => handleChange(field.key, e.target.value)}
        placeholder={field.placeholder}
      />
    );
  };

  return (
    <Card
      className={cn(
        'border',
        ocrFalhou && 'border-destructive/40 bg-destructive/5',
        ocrPedeRevisao && !ocrFalhou && 'border-amber-500/40 bg-amber-500/5',
        !ocrFalhou && !ocrPedeRevisao && 'border-border',
        className,
      )}
    >
      <CardContent className="p-4 space-y-4">
        {!hideHeader && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">Dados extraídos — {tipoLabel}</h4>
              {typeof confianca === 'number' && confianca > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {Math.round(confianca * 100)}% confiança
                </Badge>
              )}
              {ocrFalhou && (
                <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Não foi possível ler
                </Badge>
              )}
              {ocrPedeRevisao && !ocrFalhou && (
                <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Revise os dados
                </Badge>
              )}
              {!ocrFalhou && !ocrPedeRevisao && sugestao === 'aprovar' && (
                <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Lido com sucesso
                </Badge>
              )}
            </div>
            {!editing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  Salvar
                </Button>
              </div>
            )}
          </div>
        )}

        {ocrFalhou && (
          <p className="text-xs text-destructive">
            Não conseguimos ler o documento automaticamente. Preencha os campos manualmente abaixo.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {schema.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`ocr-${field.key}`} className="text-xs">
                {field.label}
                {field.important && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              {renderField(field)}
            </div>
          ))}
        </div>

        {hideHeader && editing && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Salvar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
