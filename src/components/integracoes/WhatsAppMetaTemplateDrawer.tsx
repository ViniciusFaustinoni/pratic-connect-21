import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Save, Send, Loader2 } from 'lucide-react';
import { useCriarMetaTemplate, useAtualizarMetaTemplate, useEnviarMetaTemplate } from '@/hooks/useWhatsAppMeta';

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
  const [varExemplos, setVarExemplos] = useState<Record<string, string>>({});
  const corpoRef = useRef<HTMLTextAreaElement>(null);

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
      setVarExemplos((template.variaveis_exemplo as Record<string, string>) || {});
    } else if (open && !template) {
      setNome('');
      setCategoria('UTILITY');
      setHeaderTipo('none');
      setHeaderTexto('');
      setCorpo('');
      setRodape('');
      setVarExemplos({});
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
        variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : undefined,
      });
    }
    onOpenChange(false);
  };

  const handleEnviarAprovacao = async () => {
    if (isEdit && template.id) {
      // Salvar primeiro, depois enviar
      await atualizar.mutateAsync({
        id: template.id,
        nome,
        categoria,
        header_tipo: headerTipo,
        header_texto: headerTipo === 'text' ? headerTexto : null,
        corpo,
        rodape: rodape || null,
        variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : null,
      });
      await enviar.mutateAsync(template.id);
      onOpenChange(false);
    } else {
      // Criar e depois enviar
      const created = await criar.mutateAsync({
        nome,
        categoria,
        corpo,
        header_tipo: headerTipo,
        header_texto: headerTipo === 'text' ? headerTexto : undefined,
        rodape: rodape || undefined,
        variaveis_exemplo: Object.keys(varExemplos).length > 0 ? varExemplos : undefined,
      });
      if (created?.id) {
        await enviar.mutateAsync(created.id);
      }
      onOpenChange(false);
    }
  };

  const isSaving = criar.isPending || atualizar.isPending || enviar.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[900px] w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Template' : 'Novo Template'}</SheetTitle>
        </SheetHeader>

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

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleSalvarRascunho} disabled={isSaving || !nome || !corpo}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar rascunho
              </Button>
              <Button size="sm" className="flex-1" onClick={handleEnviarAprovacao} disabled={isSaving || !nome || !corpo}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                Enviar para aprovação
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
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
