import { useState, useMemo } from 'react';
import { Bot, Save, RotateCcw, Plus, Search, Pencil, Trash2, Power, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useMayaComportamento, useSaveMayaComportamento, useMayaFaq, useUpsertMayaFaq, useDeleteMayaFaq, MayaAudiencia, MayaFaq } from '@/hooks/useMayaIA';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AUDIENCIAS: { id: MayaAudiencia; label: string; descricao: string }[] = [
  { id: 'associado', label: 'Associado', descricao: 'Cliente já ativo na PRATICCAR — dúvidas operacionais, sem vendas.' },
  { id: 'lead', label: 'Lead / Visitante', descricao: 'Prospect que ainda não é associado — funil de vendas e cotação.' },
  { id: 'diretor', label: 'Diretoria', descricao: 'Assistente executiva — relatórios e KPIs do sistema.' },
];

const CATEGORIAS_PADRAO = ['geral', 'planos', 'cobertura', 'cobranca', 'sinistro', 'instalacao', 'cancelamento'];

const PT_STOPWORDS_UI = new Set([
  'a','o','as','os','de','da','do','das','dos','e','ou','um','uma','para','por','pra','pro','com','sem','que','se','na','no','nas','nos','em','ao','aos','mais','menos','muito','sao','são','foi','era','sera','será','ter','estou','estamos','estao','estão','vai','vou','vamos','voce','você','vcs','voces','vocês','eu','tu','ele','ela','nos','nós','eles','elas','meu','minha','seu','sua','teu','tua','isso','isto','aquilo','esse','essa','este','esta','aquele','aquela','aqui','ali','la','lá','quando','onde','como','porque','qual','quais','quem','entao','então','ainda','tambem','também','todos','todas','cada','outro','outra','outros','outras','bom','boa','sim','nao','não','tem','ter','ja','já','preciso','quero','queria','sempre','assunto','qualquer','sobre','como','para','pelos','pelas','pelos','desde','entre','contra','perante','perto','sob','sobre','até','ate','apos','após','antes','depois','durante','passar','direto','direitos','diretos','canais','canal','atendimento'
]);

function sugerirPalavrasChave(pergunta?: string, resposta?: string): string[] {
  const raw = `${pergunta || ''} ${resposta || ''}`;
  const norm = raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const freq = new Map<string, number>();
  for (const t of norm.split(' ')) {
    if (t.length < 4) continue;
    if (PT_STOPWORDS_UI.has(t)) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
}


function FieldLabel({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm font-medium">{children}</Label>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground" tabIndex={-1}>
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function ComportamentoTab() {
  const [audiencia, setAudiencia] = useState<MayaAudiencia>('associado');
  const { data, isLoading } = useMayaComportamento(audiencia);
  const save = useSaveMayaComportamento();
  const [draft, setDraft] = useState<any>(null);

  const current = draft ?? data ?? null;

  const handleChange = (k: string, v: string) => {
    setDraft((prev: any) => ({ ...(prev ?? data ?? { audiencia }), [k]: v, audiencia }));
  };

  const handleSave = () => {
    if (!current) return;
    save.mutate({
      audiencia,
      nome_agente: current.nome_agente || 'Assistente IA Praticcar',
      persona: current.persona || '',
      regras_absolutas: current.regras_absolutas || '',
      tom_voz: current.tom_voz || '',
      saudacao_inicial: current.saudacao_inicial || '',
    });
    setDraft(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {AUDIENCIAS.map((a) => (
          <button
            key={a.id}
            onClick={() => { setAudiencia(a.id); setDraft(null); }}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              audiencia === a.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {AUDIENCIAS.find((a) => a.id === audiencia)?.descricao}
      </p>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <FieldLabel hint="Como o Assistente IA Praticcar se apresenta. Aparece em saudações e quando o cliente pergunta com quem está falando. Ex: 'Assistente IA Praticcar', 'Atendimento PRATIC'.">
                  Nome do agente
                </FieldLabel>
                <Input
                  value={current?.nome_agente ?? ''}
                  onChange={(e) => handleChange('nome_agente', e.target.value)}
                  placeholder="Assistente IA Praticcar"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Persona</CardTitle>
              <CardDescription>Quem o Assistente IA Praticcar é nesta audiência e qual é o papel dele.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldLabel hint="Descreve em 2-4 linhas quem o Assistente IA Praticcar é e qual a missão dele com este perfil. A IA usa isso para calibrar o que pode e não pode fazer. Ex: 'Você é o assistente virtual da PRATICCAR para associados ativos. Sua missão é resolver dúvidas operacionais simples e escalar para humanos quando envolver decisão ou prazo.'">
                Descrição da persona
              </FieldLabel>
              <Textarea
                rows={5}
                value={current?.persona ?? ''}
                onChange={(e) => handleChange('persona', e.target.value)}
                placeholder="Você é..."
                className="mt-1.5 resize-y"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regras absolutas</CardTitle>
              <CardDescription>Limites que a IA NUNCA pode violar.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldLabel hint="Use uma regra por linha começando com '-'. Tudo aqui é tratado como regra dura. Ex: '- NUNCA tente vender planos para associados.' / '- NUNCA invente valores de boletos.'">
                Lista de regras
              </FieldLabel>
              <Textarea
                rows={7}
                value={current?.regras_absolutas ?? ''}
                onChange={(e) => handleChange('regras_absolutas', e.target.value)}
                placeholder="- NUNCA invente dados&#10;- NUNCA prometa contato humano sem chamar a tool"
                className="mt-1.5 font-mono text-sm resize-y"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tom de voz</CardTitle>
              <CardDescription>Como o Assistente IA Praticcar escreve.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldLabel hint="Formalidade, uso de emojis, formatação WhatsApp (*negrito*, _itálico_), tamanho de resposta. Ex: 'Atendimento humano, claro e direto. *negrito* e _itálico_ do WhatsApp. Emojis com moderação.'">
                Estilo de escrita
              </FieldLabel>
              <Textarea
                rows={4}
                value={current?.tom_voz ?? ''}
                onChange={(e) => handleChange('tom_voz', e.target.value)}
                className="mt-1.5 resize-y"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saudação inicial</CardTitle>
              <CardDescription>Primeira mensagem quando ninguém se conhece ainda.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldLabel hint="O que o Assistente IA Praticcar envia na primeira interação. Use {{nome}} se quiser personalizar. Mantenha curto — 1 a 2 linhas.">
                Texto da saudação
              </FieldLabel>
              <Textarea
                rows={3}
                value={current?.saudacao_inicial ?? ''}
                onChange={(e) => handleChange('saudacao_inicial', e.target.value)}
                className="mt-1.5 resize-y"
              />
            </CardContent>
          </Card>

          <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {data?.atualizado_em && (
                <>Última edição em {format(new Date(data.atualizado_em), "d 'de' MMM, HH:mm", { locale: ptBR })}</>
              )}
            </div>
            <div className="flex gap-2">
              {draft && (
                <Button variant="outline" onClick={() => setDraft(null)}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Descartar
                </Button>
              )}
              <Button onClick={handleSave} disabled={!draft || save.isPending}>
                <Save className="h-4 w-4 mr-1.5" />
                {save.isPending ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FaqEditDialog({
  open, onOpenChange, item, onSave,
}: { open: boolean; onOpenChange: (b: boolean) => void; item: Partial<MayaFaq> | null; onSave: (i: Partial<MayaFaq>) => void; }) {
  const [draft, setDraft] = useState<Partial<MayaFaq>>(item ?? { audiencias: ['associado', 'lead'], categoria: 'geral', ativo: true, palavras_chave: [] });
  const [kwInput, setKwInput] = useState('');

  // reset on open
  useMemo(() => { if (open) { setDraft(item ?? { audiencias: ['associado', 'lead'], categoria: 'geral', ativo: true, palavras_chave: [] }); setKwInput(''); } }, [open, item]);

  const upd = (k: keyof MayaFaq, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const addKw = () => {
    const v = kwInput.trim();
    if (!v) return;
    upd('palavras_chave', Array.from(new Set([...(draft.palavras_chave ?? []), v])));
    setKwInput('');
  };
  const rmKw = (v: string) => upd('palavras_chave', (draft.palavras_chave ?? []).filter((k) => k !== v));

  const handleSave = () => {
    if (!draft.pergunta?.trim() || !draft.resposta?.trim()) return;
    onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? 'Editar conhecimento' : 'Novo conhecimento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel hint="Agrupa o conhecimento por tema. O Assistente IA Praticcar usa para organizar a base. Pode digitar uma nova categoria livremente.">
                Categoria
              </FieldLabel>
              <Input list="cat-suggestions" value={draft.categoria ?? ''} onChange={(e) => upd('categoria', e.target.value)} />
              <datalist id="cat-suggestions">
                {CATEGORIAS_PADRAO.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <FieldLabel hint="Ordem dentro da categoria. Menor número aparece primeiro no contexto enviado à IA.">
                Ordem
              </FieldLabel>
              <Input type="number" value={draft.ordem ?? 0} onChange={(e) => upd('ordem', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel hint="A dúvida do cliente como você espera que ela apareça. Não precisa ser literal — é mais um título do tópico.">
              Pergunta / título do tópico
            </FieldLabel>
            <Input value={draft.pergunta ?? ''} onChange={(e) => upd('pergunta', e.target.value)} placeholder="Como funciona a carência de roubo e furto?" />
          </div>

          <div className="space-y-1.5">
            <FieldLabel hint="A resposta que o Assistente IA Praticcar deve dar. Escreva como se fosse ele respondendo (em primeira pessoa). Pode incluir formatação WhatsApp: *negrito*, _itálico_.">
              Resposta
            </FieldLabel>
            <Textarea rows={6} value={draft.resposta ?? ''} onChange={(e) => upd('resposta', e.target.value)} className="resize-y" />
          </div>

          <div className="space-y-1.5">
            <FieldLabel hint="Termos que ajudam o Assistente IA Praticcar a identificar quando este conhecimento é relevante. Separe pressionando Enter.">
              Palavras-chave
            </FieldLabel>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {(draft.palavras_chave ?? []).map((k) => (
                <Badge key={k} variant="secondary" className="gap-1">
                  {k}
                  <button onClick={() => rmKw(k)} className="ml-1 text-muted-foreground hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
            <Input
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } }}
              placeholder="Digite um termo e pressione Enter"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel hint="Quais perfis recebem este conhecimento. Ex: marque apenas 'Lead' se for informação de vendas que não deve aparecer para associados.">
              Audiências
            </FieldLabel>
            <div className="flex gap-4">
              {AUDIENCIAS.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={(draft.audiencias ?? []).includes(a.id)}
                    onCheckedChange={(c) => {
                      const set = new Set(draft.audiencias ?? []);
                      if (c) set.add(a.id); else set.delete(a.id);
                      upd('audiencias', Array.from(set));
                    }}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <FieldLabel hint="Desativado some do contexto do Assistente IA Praticcar, mas continua salvo. Use para arquivar sem perder o histórico.">
              Ativo
            </FieldLabel>
            <Switch checked={draft.ativo ?? true} onCheckedChange={(c) => upd('ativo', c)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!draft.pergunta?.trim() || !draft.resposta?.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConhecimentoTab() {
  const { data: faqs = [], isLoading } = useMayaFaq();
  const upsert = useUpsertMayaFaq();
  const del = useDeleteMayaFaq();
  const [busca, setBusca] = useState('');
  const [catFilter, setCatFilter] = useState<string>('todas');
  const [editing, setEditing] = useState<Partial<MayaFaq> | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const set = new Set<string>(CATEGORIAS_PADRAO);
    faqs.forEach((f) => set.add(f.categoria));
    return Array.from(set);
  }, [faqs]);

  const filtrados = useMemo(() => {
    return faqs.filter((f) => {
      if (catFilter !== 'todas' && f.categoria !== catFilter) return false;
      if (busca) {
        const q = busca.toLowerCase();
        return f.pergunta.toLowerCase().includes(q)
          || f.resposta.toLowerCase().includes(q)
          || f.palavras_chave.some((k) => k.toLowerCase().includes(q));
      }
      return true;
    });
  }, [faqs, busca, catFilter]);

  const handleNew = () => { setEditing(null); setEditOpen(true); };
  const handleEdit = (f: MayaFaq) => { setEditing(f); setEditOpen(true); };
  const handleDuplicate = (f: MayaFaq) => {
    const { id, atualizado_em, atualizado_por, ...rest } = f as any;
    setEditing({ ...rest, pergunta: f.pergunta + ' (cópia)' });
    setEditOpen(true);
  };
  const handleToggle = (f: MayaFaq) => upsert.mutate({ ...f, ativo: !f.ativo });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pergunta, resposta ou palavra-chave…" className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={handleNew}><Plus className="h-4 w-4 mr-1.5" /> Novo conhecimento</Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {faqs.length === 0 ? 'Nenhum conhecimento cadastrado ainda. Clique em "Novo conhecimento" para começar.' : 'Nenhum item com este filtro.'}
        </CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtrados.map((f) => (
            <AccordionItem key={f.id} value={f.id} className="border rounded-lg bg-card px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex-1 flex items-center gap-3 text-left">
                  <Badge variant={f.ativo ? 'default' : 'secondary'} className="shrink-0">{f.categoria}</Badge>
                  <span className={`font-medium ${!f.ativo && 'opacity-60 line-through'}`}>{f.pergunta}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{f.resposta}</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.palavras_chave.map((k) => <Badge key={k} variant="outline" className="text-xs">{k}</Badge>)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Audiências: {f.audiencias.join(', ') || '—'}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(f)}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(f)}>Duplicar</Button>
                  <Button size="sm" variant="outline" onClick={() => handleToggle(f)}>
                    <Power className="h-3.5 w-3.5 mr-1.5" /> {f.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={() => setConfirmDel(f.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <FaqEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={editing}
        onSave={(payload) => { upsert.mutate(payload); setEditOpen(false); }}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este conhecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O Assistente IA Praticcar deixará de usar essa informação imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDel) del.mutate(confirmDel); setConfirmDel(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MayaIA() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Config. IA</h1>
          <p className="text-sm text-muted-foreground">
            Configure como o Assistente IA Praticcar se comporta e o que ele sabe. Mudanças entram em vigor em até 60 segundos.
          </p>
        </div>
      </div>

      <Tabs defaultValue="comportamento" className="space-y-4">
        <TabsList>
          <TabsTrigger value="comportamento">Comportamento</TabsTrigger>
          <TabsTrigger value="conhecimento">Conhecimento (FAQ)</TabsTrigger>
        </TabsList>
        <TabsContent value="comportamento"><ComportamentoTab /></TabsContent>
        <TabsContent value="conhecimento"><ConhecimentoTab /></TabsContent>
      </Tabs>
    </div>
  );
}
