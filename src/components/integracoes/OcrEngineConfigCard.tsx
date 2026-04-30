import { useEffect, useState } from 'react';
import { ScanText, Loader2, KeyRound, Eye, EyeOff, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  OCR_ENGINE_LABELS, OCR_ENGINE_MODELS, OcrEngine,
  useOcrEngineConfig, useUpdateOcrEngineConfig,
} from '@/hooks/useOcrEngineConfig';
import { useAIProviderKeysStatus, useSetAIProviderKey, useRemoveAIProviderKey } from '@/hooks/useAIProviderKeys';
import { usePermissions } from '@/hooks/usePermissions';

export function OcrEngineConfigCard() {
  const { data, isLoading } = useOcrEngineConfig();
  const update = useUpdateOcrEngineConfig();
  const keysStatus = useAIProviderKeysStatus();
  const setKey = useSetAIProviderKey();
  const removeKey = useRemoveAIProviderKey();
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const canEdit = isDiretor || isDesenvolvedor;

  const [engine, setEngine] = useState<OcrEngine>('global');
  const [primaryModel, setPrimaryModel] = useState('mistral-ocr-latest');
  const [secondaryModel, setSecondaryModel] = useState('claude-sonnet-4-5');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (data) {
      setEngine(data.engine);
      setPrimaryModel(data.primary_model);
      setSecondaryModel(data.secondary_model ?? '');
    }
  }, [data]);

  const showKeyInput = engine === 'mistral';
  const mistralConfigured = !!keysStatus.data?.mistral;
  const dirty = data
    ? data.engine !== engine || data.primary_model !== primaryModel || (data.secondary_model ?? '') !== secondaryModel
    : true;
  const models = engine !== 'global' ? OCR_ENGINE_MODELS[engine] : null;

  if (isLoading) {
    return <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Motor de OCR (leitura de documentos)</CardTitle>
          </div>
          <Badge variant="secondary">{OCR_ENGINE_LABELS[engine]}</Badge>
        </div>
        <CardDescription>
          Vale <strong>somente para leitura de documentos</strong> (CNH, CRLV, RG, comprovante etc.).
          Não afeta chat, Maya, análise de risco ou WhatsApp.
          <br />Documentos críticos (<strong>CNH e CRLV</strong>) passam por <strong>dupla leitura automática</strong> com motor secundário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Motor</Label>
            <Select value={engine} onValueChange={(v) => setEngine(v as OcrEngine)} disabled={!canEdit || update.isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">{OCR_ENGINE_LABELS.global}</SelectItem>
                <SelectItem value="mistral">{OCR_ENGINE_LABELS.mistral}</SelectItem>
                <SelectItem value="anthropic">{OCR_ENGINE_LABELS.anthropic}</SelectItem>
                <SelectItem value="google">{OCR_ENGINE_LABELS.google}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {models && (
            <>
              <div className="space-y-2">
                <Label>Modelo principal</Label>
                <Select value={primaryModel} onValueChange={setPrimaryModel} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {models.primary.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>2ª opinião (CNH/CRLV)</Label>
                <Select value={secondaryModel} onValueChange={setSecondaryModel} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {models.secondary.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {showKeyInput && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Chave de API Mistral</span>
              </div>
              {mistralConfigured ? (
                <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Configurada</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Não configurada</Badge>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={mistralConfigured ? '•••••••• (digite para substituir)' : 'sua chave Mistral'}
                  disabled={!canEdit || setKey.isPending}
                  className="pr-10 font-mono text-xs"
                />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={() => setKey.mutate({ provider: 'mistral', value: apiKey }, { onSuccess: () => setApiKey('') })} disabled={!canEdit || setKey.isPending || apiKey.trim().length < 10}>
                {setKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar chave
              </Button>
              {mistralConfigured && (
                <Button variant="outline" onClick={() => removeKey.mutate('mistral')} disabled={!canEdit || removeKey.isPending}>Remover</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Obtenha em <code className="text-xs px-1 py-0.5 rounded bg-muted">console.mistral.ai</code>. Armazenada no backend (<code>MISTRAL_API_KEY</code>).
            </p>
          </div>
        )}

        {engine === 'global' && (
          <Alert>
            <ScanText className="h-4 w-4" />
            <AlertDescription>
              Usando o provedor global. Para PDFs problemáticos (ex.: CNH-e SENATRAN), as páginas são <strong>convertidas em imagem em alta resolução</strong> antes de irem pra IA — corrige documentos que vinham vazios.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          {!canEdit && <p className="text-xs text-muted-foreground mr-auto">Apenas Diretor ou Desenvolvedor pode alterar.</p>}
          <Button
            onClick={() => update.mutate({ engine, primary_model: primaryModel, secondary_model: secondaryModel || null })}
            disabled={!canEdit || !dirty || update.isPending}
          >
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar motor de OCR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
