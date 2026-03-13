import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Save, Send, Loader2, Bot, CheckCircle, AlertTriangle, XCircle, X, Link, Phone, Reply } from 'lucide-react';

interface BotaoAcao {
  tipo: 'url' | 'telefone' | 'resposta_rapida';
  texto: string;
  url?: string;
  telefone?: string;
}
import { useCriarMetaTemplate, useAtualizarMetaTemplate, useEnviarMetaTemplate } from '@/hooks/useWhatsAppMeta';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IAValidationResult {
  score: number;
  aprovado: boolean;
  problemas: string[];
  sugestoes: string[];
  resumo: string;
  corpo_sugerido?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
}

export function WhatsAppMetaTemplateDrawer({ open, onOpenChange, template }: Props) {
  const isEdit = !!template;

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('UTILITY');
  const [headerTipo, setHeaderTipo] = useState('none');
  const [headerTexto, setHeaderTexto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [rodape, setRodape] = useState('');
  const [botoes, setBotoes] = useState<BotaoAcao[]>([]);
  const [varExemplos, setVarExemplos] = useState<Record<string, string>>({});
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  const [validacao, setValidacao] = useState<IAValidationResult | null>(null);
  const [validando, setValidando] = useState(false);

  const criar = useCriarMetaTemplate();
  const atualizar = useAtualizarMetaTemplate();
  const enviar = useEnviarMetaTemplate();

  useEffect(() => {
    if (open && template) {
      setNome(template.nome || '');
      setCategoria(template.categoria || 'UTILITY');
      setHeaderTipo(template.header_tipo || 'none');
      setHeaderTexto(template.header_texto || '');
      setCorpo(template.corpo || '');
      setRodape(template.rodape || '');
      // Normalizar botões: aceitar tanto tipo/texto quanto type/text
      const rawBotoes = (template.botoes as any[]) || [];
      const normalized = rawBotoes.map((b: any) => ({
        tipo: (b.tipo || (b.type || '').toLowerCase().replace('phone_number', 'telefone').replace('quick_reply', 'resposta_rapida')) as BotaoAcao['tipo'],
        texto: b.texto || b.text || '',
        url: b.url || '',
        telefone: b.telefone || b.phone_number || '',
      }));
      setBotoes(normalized);
      setVarExemplos((template.variaveis_exemplo as Record<string, string>) || {});
      setValidacao(null);
    } else if (open && !template) {
      setNome('');
      setCategoria('UTILITY');
      setHeaderTipo('none');
      setHeaderTexto('');
      setCorpo('');
      setRodape('');
      setBotoes([]);
      setVarExemplos({});
      setValidacao(null);
    }
  }, [open, template]);

  // Extrair variáveis do corpo
  const variaveis = (corpo.match(/\{\{(\d+)\}\}/g) || [])
    .map((v) => v.replace(/[{}]/g, ''))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => parseInt(a) - parseInt(b));

  const adicionarVariavel = () => {
    const next = variaveis.length > 0 ? Math.max(...variaveis.map(Number)) + 1 : 1;
    const el = corpoRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newCorpo = corpo.substring(0, start) + `{{${next}}}` + corpo.substring(end);
      setCorpo(newCorpo);
    } else {
      setCorpo(corpo + `{{${next}}}`);
    }
  };

  // Preview: substituir variáveis
  const previewCorpo = variaveis.reduce((text, v) => {
    const exemplo = varExemplos[v] || `[variável ${v}]`;
    return text.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), exemplo);
  }, corpo);

  const handleValidarIA = async () => {
    if (!nome || !corpo) {
      toast.error('Preencha o nome e corpo do template antes de validar.');
      return;
    }
    setValidando(true);
    setValidacao(null);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-template-validar', {
        body: {
          nome,
          categoria,
          corpo,
          header_tipo: headerTipo,
          header_texto: headerTipo === 'text' ? headerTexto : null,
          rodape: rodape || null,
          variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : null,
          motivo_rejeicao: template?.motivo_rejeicao || null,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setValidacao({
        score: data.score,
        aprovado: data.aprovado,
        problemas: data.problemas || [],
        sugestoes: data.sugestoes || [],
        resumo: data.resumo || '',
        corpo_sugerido: data.corpo_sugerido || undefined,
      });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao validar template com IA');
    } finally {
      setValidando(false);
    }
  };

  const botoesPayload = botoes.length > 0 ? botoes : null;

  const handleSalvarRascunho = async () => {
    if (!nome || !corpo) return;
    if (isEdit) {
      await atualizar.mutateAsync({
        id: template.id,
        nome,
        categoria,
        header_tipo: headerTipo,
        header_texto: headerTipo === 'text' ? headerTexto : null,
        corpo,
        rodape: rodape || null,
        botoes: botoesPayload,
        variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : null,
      });
    } else {
      await criar.mutateAsync({
        nome,
        categoria,
        corpo,
        header_tipo: headerTipo,
        header_texto: headerTipo === 'text' ? headerTexto : undefined,
        rodape: rodape || undefined,
        botoes: botoesPayload as any,
        variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : undefined,
      });
    }
    onOpenChange(false);
  };

  const handleEnviarAprovacao = async () => {
    if (isEdit && template.id) {
      await atualizar.mutateAsync({
        id: template.id,
        nome,
        categoria,
        header_tipo: headerTipo,
        header_texto: headerTipo === 'text' ? headerTexto : null,
        corpo,
        rodape: rodape || null,
        botoes: botoesPayload,
        variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : null,
      });
      await enviar.mutateAsync(template.id);
      onOpenChange(false);
    } else {
      const created = await criar.mutateAsync({
        nome,
        categoria,
        corpo,
        header_tipo: headerTipo,
        header_texto: headerTipo === 'text' ? headerTexto : undefined,
        rodape: rodape || undefined,
        botoes: botoesPayload as any,
        variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : undefined,
      });
      if (created?.id) {
        await enviar.mutateAsync(created.id);
      }
      onOpenChange(false);
    }
  };

  const isSaving = criar.isPending || atualizar.isPending || enviar.isPending;

  const scoreColor = validacao
    ? validacao.score >= 8
      ? 'text-green-600'
      : validacao.score >= 5
        ? 'text-yellow-600'
        : 'text-destructive'
    : '';

  const ScoreIcon = validacao
    ? validacao.aprovado
      ? CheckCircle
      : validacao.score >= 5
        ? AlertTriangle
        : XCircle
    : Bot;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[900px] w-full overflow-y-auto">
        <SheetHeader>
        <SheetTitle>{isEdit ? 'Editar Template' : 'Novo Template'}</SheetTitle>
        </SheetHeader>

        {/* Alerta para templates PENDING ou REJECTED */}
        {isEdit && (template?.status === 'PENDING' || template?.status === 'REJECTED') && (
          <Alert className={`mt-4 ${template.status === 'REJECTED' ? 'border-destructive/40 bg-destructive/5' : 'border-yellow-500/40 bg-yellow-500/5'}`}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {template.status === 'PENDING'
                ? 'Este template está pendente de aprovação na Meta. Ao editar e reenviar, a versão anterior será deletada e substituída pela nova.'
                : `Este template foi rejeitado. ${template.motivo_rejeicao ? `Motivo: "${template.motivo_rejeicao}". ` : ''}Corrija o conteúdo e reenvie para aprovação — a versão anterior será substituída.`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Formulário */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome do template *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="ex: boas_vindas_associado"
                className="font-mono text-xs"
                disabled={isEdit && template?.status !== 'DRAFT'}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Apenas letras minúsculas, números e underscores</p>
            </div>

            <div>
              <Label className="text-xs">Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">UTILITY — Notificações transacionais</SelectItem>
                  <SelectItem value="MARKETING">MARKETING — Promoções e engajamento</SelectItem>
                  <SelectItem value="AUTHENTICATION">AUTHENTICATION — Códigos de verificação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Idioma</Label>
              <Input value="pt_BR — Português (Brasil)" readOnly className="h-8 text-xs bg-muted" />
            </div>

            <div>
              <Label className="text-xs">Cabeçalho</Label>
              <Select value={headerTipo} onValueChange={setHeaderTipo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                </SelectContent>
              </Select>
              {headerTipo === 'text' && (
                <Input
                  className="h-8 text-xs mt-1"
                  value={headerTexto}
                  onChange={(e) => setHeaderTexto(e.target.value.substring(0, 60))}
                  placeholder="Texto do cabeçalho (máx 60 chars)"
                  maxLength={60}
                />
              )}
              {(headerTipo === 'image' || headerTipo === 'document') && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  A mídia será definida no momento do envio
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Corpo da mensagem *</Label>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={adicionarVariavel}>
                    <Plus className="h-3 w-3 mr-0.5" /> Variável
                  </Button>
                  <span className="text-[10px] text-muted-foreground">{corpo.length}/1024</span>
                </div>
              </div>
              <Textarea
                ref={corpoRef}
                value={corpo}
                onChange={(e) => setCorpo(e.target.value.substring(0, 1024))}
                placeholder="Olá {{1}}, sua mensalidade de {{2}} vence em {{3}}."
                className="min-h-[120px] text-xs"
                maxLength={1024}
              />
            </div>

            {/* Exemplos de variáveis */}
            {variaveis.length > 0 && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Exemplos das variáveis (obrigatório)</p>
                {variaveis.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">{`{{${v}}}`}</Badge>
                    <Input
                      className="h-7 text-xs"
                      value={varExemplos[v] || ''}
                      onChange={(e) => setVarExemplos({ ...varExemplos, [v]: e.target.value })}
                      placeholder={`Exemplo para {{${v}}}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label className="text-xs">Rodapé (opcional)</Label>
              <Input
                value={rodape}
                onChange={(e) => setRodape(e.target.value.substring(0, 60))}
                placeholder="PraticCar Proteção Veicular"
                className="h-8 text-xs"
                maxLength={60}
              />
              <span className="text-[10px] text-muted-foreground">{rodape.length}/60</span>
            </div>

            {/* Botões de Ação */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Botões de ação (opcional)</Label>
                <span className="text-[10px] text-muted-foreground">{botoes.length}/3</span>
              </div>
              
              {botoes.map((btn, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 p-2 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Select
                      value={btn.tipo}
                      onValueChange={(val: 'url' | 'telefone' | 'resposta_rapida') => {
                        const updated = [...botoes];
                        updated[idx] = { ...updated[idx], tipo: val, url: '', telefone: '' };
                        setBotoes(updated);
                      }}
                    >
                      <SelectTrigger className="h-7 text-[10px] w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="url">🔗 URL</SelectItem>
                        <SelectItem value="telefone">📞 Telefone</SelectItem>
                        <SelectItem value="resposta_rapida">↩️ Resposta Rápida</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-7 text-[10px] flex-1"
                      value={btn.texto}
                      onChange={(e) => {
                        const updated = [...botoes];
                        updated[idx] = { ...updated[idx], texto: e.target.value.substring(0, 25) };
                        setBotoes(updated);
                      }}
                      placeholder="Texto do botão (máx 25)"
                      maxLength={25}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive"
                      onClick={() => setBotoes(botoes.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {btn.tipo === 'url' && (
                    <Input
                      className="h-7 text-[10px]"
                      value={btn.url || ''}
                      onChange={(e) => {
                        const updated = [...botoes];
                        updated[idx] = { ...updated[idx], url: e.target.value };
                        setBotoes(updated);
                      }}
                      placeholder="https://exemplo.com/pagina"
                    />
                  )}
                  {btn.tipo === 'telefone' && (
                    <Input
                      className="h-7 text-[10px]"
                      value={btn.telefone || ''}
                      onChange={(e) => {
                        const updated = [...botoes];
                        updated[idx] = { ...updated[idx], telefone: e.target.value };
                        setBotoes(updated);
                      }}
                      placeholder="+5521999999999"
                    />
                  )}
                </div>
              ))}

              {botoes.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-[10px]"
                  onClick={() => setBotoes([...botoes, { tipo: 'url', texto: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar botão
                </Button>
              )}
            </div>

            <Separator />

            {/* Resultado da validação IA */}
            {validacao && (
              <div className={`rounded-lg border p-3 space-y-2 ${validacao.aprovado ? 'border-green-500/30 bg-green-500/5' : validacao.score >= 5 ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex items-center gap-2">
                  <ScoreIcon className={`h-4 w-4 ${scoreColor}`} />
                  <span className={`text-sm font-semibold ${scoreColor}`}>
                    Score: {validacao.score}/10
                  </span>
                  <Badge className={validacao.aprovado ? 'bg-green-500/20 text-green-700' : 'bg-destructive/20 text-destructive'}>
                    {validacao.aprovado ? 'Provável aprovação' : 'Risco de rejeição'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{validacao.resumo}</p>
                {validacao.problemas.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-destructive uppercase mb-1">Problemas</p>
                    <ul className="space-y-0.5">
                      {validacao.problemas.map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1">
                          <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {validacao.sugestoes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-yellow-600 uppercase mb-1">Sugestões</p>
                    <ul className="space-y-0.5">
                      {validacao.sugestoes.map((s, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1">
                          <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {validacao.corpo_sugerido && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-primary uppercase mb-1">Corpo sugerido pela IA</p>
                    <p className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap border">{validacao.corpo_sugerido}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => {
                        setCorpo(validacao.corpo_sugerido!);
                        toast.success('Corpo do template atualizado com a sugestão da IA');
                      }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Aplicar sugestão
                    </Button>
                  </div>
                )}
                {!validacao.aprovado && (
                  <Alert className="border-destructive/30">
                    <AlertTriangle className="h-3 w-3" />
                    <AlertDescription className="text-[10px]">
                      Recomendamos corrigir os problemas acima antes de enviar para aprovação da Meta.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidarIA}
                disabled={validando || !nome || !corpo}
                className="shrink-0"
              >
                {validando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bot className="h-3 w-3 mr-1" />}
                Validar com IA
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleSalvarRascunho} disabled={isSaving || !nome || !corpo}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar
              </Button>
              <Button size="sm" className="flex-1" onClick={handleEnviarAprovacao} disabled={isSaving || !nome || !corpo}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                Enviar
              </Button>
            </div>
          </div>

          {/* Preview WhatsApp */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Prévia da mensagem</p>
            <div className="bg-[#E5DDD5] dark:bg-[#1a1a2e] rounded-xl p-4 min-h-[300px]">
              <div className="max-w-[280px] ml-auto">
                <div className="bg-[#DCF8C6] dark:bg-[#005C4B] rounded-lg p-3 shadow-sm space-y-1.5">
                  {headerTipo === 'text' && headerTexto && (
                    <p className="text-xs font-bold text-[#111] dark:text-white">{headerTexto}</p>
                  )}
                  {headerTipo === 'image' && (
                    <div className="h-32 bg-muted/50 rounded flex items-center justify-center text-xs text-muted-foreground">
                      [Imagem]
                    </div>
                  )}
                  {headerTipo === 'document' && (
                    <div className="h-12 bg-muted/50 rounded flex items-center justify-center text-xs text-muted-foreground">
                      [Documento]
                    </div>
                  )}
                  <p className="text-[13px] text-[#111] dark:text-white whitespace-pre-wrap leading-relaxed">
                    {previewCorpo || 'Prévia da mensagem aparecerá aqui...'}
                  </p>
                  {rodape && (
                    <p className="text-[10px] text-[#667781] dark:text-gray-400">{rodape}</p>
                  )}
                  <p className="text-[10px] text-[#667781] dark:text-gray-400 text-right">10:30 ✓✓</p>
                </div>
                {/* Botões preview */}
                {botoes.length > 0 && (
                  <div className="bg-[#DCF8C6] dark:bg-[#005C4B] rounded-lg shadow-sm overflow-hidden mt-0.5">
                    {botoes.map((btn, idx) => (
                      <div key={idx}>
                        {idx > 0 && <div className="border-t border-[#c5e8b0] dark:border-[#004a3d]" />}
                        <button className="w-full py-2 px-3 text-center text-xs text-[#027eb5] dark:text-[#53bdeb] font-medium flex items-center justify-center gap-1.5">
                          {btn.tipo === 'url' && <Link className="h-3 w-3" />}
                          {btn.tipo === 'telefone' && <Phone className="h-3 w-3" />}
                          {btn.tipo === 'resposta_rapida' && <Reply className="h-3 w-3" />}
                          {btn.texto || 'Botão'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
