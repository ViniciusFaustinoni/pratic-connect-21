import { useEffect, useMemo, useState } from 'react';
import {
  Bot, Power, Sparkles, Save, Plus, Trash2, AlertTriangle, Clock, Loader2, ShieldOff,
  Pencil, X, Search, ChevronDown, Settings2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  useIAHabilidades, useToggleIAHabilidade, useUpsertIAHabilidade,
  useIAConhecimento, useUpsertIAConhecimento, useDeleteIAConhecimento,
  useIAExemplos, useUpsertIAExemplo, useDeleteIAExemplo,
  type IAHabilidade, type IAConhecimento, type IAExemplo,
} from '@/hooks/useIAHabilidades';

const SLUG = 'relacionamento';

const TOOLS_CATALOG: { name: string; descricao: string }[] = [
  { name: 'consultar_boletos_associado', descricao: 'Consulta boletos do associado no SGA' },
  { name: 'solicitar_atendente_humano', descricao: 'Escala para humano (transbordo Relacionamento)' },
  { name: 'consultar_placa', descricao: 'Consulta dados de placa (FIPE)' },
  { name: 'obter_opcoes_vencimento', descricao: 'Lista dias de vencimento disponíveis' },
];

export default function ConfigIA() {
  const { data: habilidades = [], isLoading } = useIAHabilidades();
  const habilidade = habilidades.find(h => h.slug === SLUG) || null;

  const [killSwitchOff, setKillSwitchOff] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('whatsapp_instancias')
        .select('ia_habilitada')
        .eq('principal', true)
        .maybeSingle();
      if (data && data.ia_habilitada === false) setKillSwitchOff(true);
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Configuração da IA de Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Conhecimento, exemplos e regras da IA que atende associados no WhatsApp.
          </p>
        </div>
      </div>

      {killSwitchOff && (
        <Alert variant="destructive">
          <ShieldOff className="h-4 w-4" />
          <AlertDescription>
            A IA está <strong>desligada por completo</strong> no painel de integrações (admin).
            Enquanto isso, esta habilidade fica bloqueada em runtime — mesmo se o switch abaixo
            estiver ligado. O estado individual é preservado e será respeitado assim que o
            desligamento geral for revertido.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Esta IA atende <strong>associados</strong> 24/7 (atendimento receptivo). Quando desligada
          aqui, mensagens entrando no WhatsApp ficam aguardando atendimento humano (com aviso ao
          cliente). Pedidos fora do escopo (cotação de novo veículo, RH, imprensa, etc.) são
          <strong> direcionados</strong> via itens da categoria <code>direcionamento</code> na aba
          <em> Conhecimento</em> — preencha o destino real antes de ativar cada item.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
          </CardContent>
        </Card>
      ) : !habilidade ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Configuração não encontrada. Contate o suporte.
          </CardContent>
        </Card>
      ) : (
        <EditorHabilidade habilidade={habilidade} />
      )}
    </div>
  );
}

function EditorHabilidade({ habilidade }: { habilidade: IAHabilidade }) {
  const toggle = useToggleIAHabilidade();
  const [ativaLocal, setAtivaLocal] = useState(habilidade.ativa);
  useEffect(() => { setAtivaLocal(habilidade.ativa); }, [habilidade.slug, habilidade.ativa]);

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <Card className={ativaLocal ? '' : 'border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Power className={`h-5 w-5 ${ativaLocal ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              <div>
                <CardTitle className="text-base">IA de Atendimento</CardTitle>
                <CardDescription>
                  {ativaLocal
                    ? 'Respondendo automaticamente no WhatsApp.'
                    : 'Desligada — mensagens vão direto para atendimento humano.'}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Switch
                checked={ativaLocal}
                onCheckedChange={(ativa) => {
                  setAtivaLocal(ativa);
                  toggle.mutate({ slug: habilidade.slug, ativa });
                }}
                disabled={toggle.isPending}
              />
              <span className="text-xs text-muted-foreground">{ativaLocal ? 'Ativa' : 'Desligada'}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Abas principais — uso diário do Relacionamento */}
      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="conhecimento">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="conhecimento">Conhecimento (FAQ)</TabsTrigger>
              <TabsTrigger value="exemplos">Exemplos</TabsTrigger>
              <TabsTrigger value="config">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="conhecimento" className="mt-4">
              <ConhecimentoTab slug={habilidade.slug} />
            </TabsContent>

            <TabsContent value="exemplos" className="mt-4">
              <ExemplosTab slug={habilidade.slug} />
            </TabsContent>

            <TabsContent value="config" className="mt-4">
              <ConfigAvancada habilidade={habilidade} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── Configuração avançada ───────────────────────────

function ConfigAvancada({ habilidade }: { habilidade: IAHabilidade }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IAHabilidade>(habilidade);
  useEffect(() => { setForm(habilidade); }, [habilidade.slug, habilidade.atualizado_em]);

  const upsert = useUpsertIAHabilidade();
  const handleSave = () => upsert.mutate(form);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 rounded-lg text-left">
            <div className="flex items-center gap-3">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Configuração avançada</div>
                <div className="text-xs text-muted-foreground">
                  Identidade & regras, ferramentas e horário de atendimento
                </div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-6">
            <Separator />

            {/* Identidade & Regras */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Identidade & Regras</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome exibido internamente</Label>
                  <Input value={form.nome_exibicao} onChange={e => setForm({ ...form, nome_exibicao: e.target.value })} />
                </div>
                <div>
                  <Label>Como a IA assina mensagens</Label>
                  <Input value={form.nome_agente} onChange={e => setForm({ ...form, nome_agente: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição (uso interno)</Label>
                <Input value={form.descricao || ''} onChange={e => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div>
                <Label>Persona</Label>
                <Textarea rows={3} value={form.persona} onChange={e => setForm({ ...form, persona: e.target.value })} />
              </div>
              <div>
                <Label>Regras absolutas</Label>
                <Textarea rows={4} value={form.regras_absolutas} onChange={e => setForm({ ...form, regras_absolutas: e.target.value })} />
              </div>
              <div>
                <Label>Tom de voz</Label>
                <Textarea rows={2} value={form.tom_voz} onChange={e => setForm({ ...form, tom_voz: e.target.value })} />
              </div>
              <div>
                <Label>Saudação inicial</Label>
                <Textarea rows={2} value={form.saudacao_inicial} onChange={e => setForm({ ...form, saudacao_inicial: e.target.value })} />
              </div>
            </div>

            <Separator />

            {/* Ferramentas */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Ferramentas que esta IA pode usar</h3>
              <div className="space-y-1.5">
                {TOOLS_CATALOG.map(t => {
                  const on = form.ferramentas_habilitadas.includes(t.name);
                  return (
                    <label key={t.name} className="flex items-start gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                      <input type="checkbox" checked={on} className="mt-1"
                        onChange={() => setForm({
                          ...form,
                          ferramentas_habilitadas: on
                            ? form.ferramentas_habilitadas.filter(x => x !== t.name)
                            : [...form.ferramentas_habilitadas, t.name],
                        })} />
                      <div>
                        <div className="text-sm font-mono">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.descricao}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Horário */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Horário de atendimento <span className="text-xs font-normal text-muted-foreground">(vazio = 24/7)</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="início HH:MM" value={form.horario_atendimento?.inicio || ''}
                  onChange={e => setForm({
                    ...form,
                    horario_atendimento: {
                      ...(form.horario_atendimento || { dias: ['seg','ter','qua','qui','sex'], timezone: 'America/Sao_Paulo' }),
                      inicio: e.target.value,
                    },
                  })} />
                <Input placeholder="fim HH:MM" value={form.horario_atendimento?.fim || ''}
                  onChange={e => setForm({
                    ...form,
                    horario_atendimento: {
                      ...(form.horario_atendimento || { dias: ['seg','ter','qua','qui','sex'], timezone: 'America/Sao_Paulo' }),
                      fim: e.target.value,
                    },
                  })} />
              </div>
              <div>
                <Label className="text-xs">Mensagem fora do horário</Label>
                <Textarea rows={2} value={form.mensagem_fora_horario || ''}
                  onChange={e => setForm({ ...form, mensagem_fora_horario: e.target.value })} />
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => setForm({ ...form, horario_atendimento: null, mensagem_fora_horario: null })}>
                Limpar (= 24/7)
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {form.audiencias_elegiveis.map(a => (
                <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={upsert.isPending}>
                <Save className="h-4 w-4 mr-2" /> Salvar configuração avançada
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─────────────────────────── Conhecimento (FAQ) ───────────────────────────

function ConhecimentoTab({ slug }: { slug: string }) {
  const { data: itens = [] } = useIAConhecimento(slug);
  const upsert = useUpsertIAConhecimento();
  const del = useDeleteIAConhecimento();

  const [novo, setNovo] = useState({ pergunta: '', resposta: '', categoria: 'geral' });
  const [busca, setBusca] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IAConhecimento | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(i =>
      i.pergunta.toLowerCase().includes(q) ||
      i.resposta.toLowerCase().includes(q) ||
      i.categoria.toLowerCase().includes(q),
    );
  }, [itens, busca]);

  const grupos = useMemo(() => {
    const map = new Map<string, IAConhecimento[]>();
    for (const item of filtrados) {
      const cat = item.categoria || 'geral';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    // direcionamento sempre primeiro (chama mais atenção)
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'direcionamento') return -1;
      if (b === 'direcionamento') return 1;
      return a.localeCompare(b);
    });
  }, [filtrados]);

  return (
    <div className="space-y-3">
      {/* Busca + contador + novo */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar em ${itens.length} item${itens.length === 1 ? '' : 's'}…`}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant={formOpen ? 'secondary' : 'default'} size="sm" onClick={() => setFormOpen(o => !o)}>
          {formOpen ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {formOpen ? 'Fechar' : 'Novo'}
        </Button>
      </div>

      {formOpen && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Input placeholder="Categoria (ex: boletos, cancelamento, direcionamento)" value={novo.categoria}
              onChange={e => setNovo({ ...novo, categoria: e.target.value })} />
            <Input placeholder="Pergunta / gatilho" value={novo.pergunta}
              onChange={e => setNovo({ ...novo, pergunta: e.target.value })} />
            <Textarea rows={3} placeholder="Resposta que a IA deve dar" value={novo.resposta}
              onChange={e => setNovo({ ...novo, resposta: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button size="sm" disabled={upsert.isPending} onClick={async () => {
                if (!novo.pergunta || !novo.resposta) return;
                await upsert.mutateAsync({ habilidade_slug: slug, ...novo });
                setNovo({ pergunta: '', resposta: '', categoria: 'geral' });
                setFormOpen(false);
              }}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar ao FAQ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {grupos.map(([categoria, lista]) => (
          <div key={categoria} className="space-y-2">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-1 flex items-center gap-2">
              <Badge variant={categoria === 'direcionamento' ? 'default' : 'outline'} className="text-xs">
                {categoria}
              </Badge>
              <span className="text-xs text-muted-foreground">{lista.length}</span>
            </div>
            {lista.map(item => (
              <ConhecimentoCard
                key={item.id}
                item={item}
                slug={slug}
                editing={editingId === item.id}
                onEdit={() => setEditingId(item.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
                onDelete={() => setConfirmDelete(item)}
              />
            ))}
          </div>
        ))}
        {filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {busca ? 'Nenhum item bate com a busca.' : 'Nenhum item de FAQ cadastrado.'}
          </p>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este item do FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.pergunta}
              <br /><br />
              A IA deixa de usar esta resposta a partir da próxima mensagem. Atendimentos em andamento não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) del.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConhecimentoCard({
  item, slug, editing, onEdit, onCancelEdit, onSaved, onDelete,
}: {
  item: IAConhecimento;
  slug: string;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const upsert = useUpsertIAConhecimento();
  const [draft, setDraft] = useState({
    categoria: item.categoria,
    pergunta: item.pergunta,
    resposta: item.resposta,
    ativo: item.ativo,
  });
  useEffect(() => {
    if (editing) {
      setDraft({ categoria: item.categoria, pergunta: item.pergunta, resposta: item.resposta, ativo: item.ativo });
    }
  }, [editing, item.id, item.atualizado_em]);

  const isDirecionamento = item.categoria === 'direcionamento';
  const semDestino = isDirecionamento && !item.ativo && (!item.resposta || item.resposta.trim().length < 5);

  const cardCls = [
    isDirecionamento ? 'border-amber-500/50' : '',
    item.revisar ? 'border-amber-500/40' : '',
    !item.ativo ? 'bg-muted/30' : '',
  ].filter(Boolean).join(' ');

  if (editing) {
    return (
      <Card className={cardCls}>
        <CardContent className="pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.ativo}
              onCheckedChange={(v) => setDraft({ ...draft, ativo: v })}
            />
            <span className="text-xs text-muted-foreground">{draft.ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
          <Input value={draft.categoria} onChange={e => setDraft({ ...draft, categoria: e.target.value })} placeholder="Categoria" />
          <Input value={draft.pergunta} onChange={e => setDraft({ ...draft, pergunta: e.target.value })} placeholder="Pergunta / gatilho" />
          <Textarea rows={5} value={draft.resposta} onChange={e => setDraft({ ...draft, resposta: e.target.value })} placeholder="Resposta que a IA deve dar" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Salvar não interrompe atendimentos em curso. A nova versão passa a valer da próxima mensagem.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>Cancelar</Button>
              <Button size="sm" disabled={upsert.isPending}
                onClick={async () => {
                  await upsert.mutateAsync({
                    id: item.id,
                    habilidade_slug: slug,
                    categoria: draft.categoria,
                    pergunta: draft.pergunta,
                    resposta: draft.resposta,
                    ativo: draft.ativo,
                    revisar: false,
                  });
                  onSaved();
                }}
              >
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardCls}>
      <CardContent className="pt-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{item.categoria}</Badge>
            {item.ativo ? (
              <Badge variant="secondary" className="text-xs text-emerald-700 dark:text-emerald-400">Ativo</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs text-muted-foreground">Inativo</Badge>
            )}
            {item.revisar && <Badge variant="outline" className="text-xs text-amber-600">revisar</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="Remover">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="text-sm font-medium">{item.pergunta}</div>
        <div className="text-xs text-muted-foreground whitespace-pre-wrap">{item.resposta}</div>

        {semDestino && (
          <Alert variant="destructive" className="mt-2 py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Sem destino — preencher antes de ativar.</strong> Este item entrou inativo de propósito
              porque o link/contato ainda não foi confirmado. Edite a resposta com o destino real e então
              ative para que a IA passe a usar.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Exemplos ───────────────────────────

function ExemplosTab({ slug }: { slug: string }) {
  const { data: itens = [] } = useIAExemplos(slug);
  const upsert = useUpsertIAExemplo();
  const del = useDeleteIAExemplo();

  const [novo, setNovo] = useState({ titulo: '', entrada_usuario: '', resposta_ideal: '' });
  const [busca, setBusca] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IAExemplo | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(i =>
      i.titulo.toLowerCase().includes(q) ||
      i.entrada_usuario.toLowerCase().includes(q) ||
      i.resposta_ideal.toLowerCase().includes(q),
    );
  }, [itens, busca]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar em ${itens.length} exemplo${itens.length === 1 ? '' : 's'}…`}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant={formOpen ? 'secondary' : 'default'} size="sm" onClick={() => setFormOpen(o => !o)}>
          {formOpen ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {formOpen ? 'Fechar' : 'Novo'}
        </Button>
      </div>

      {formOpen && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Input placeholder="Título" value={novo.titulo}
              onChange={e => setNovo({ ...novo, titulo: e.target.value })} />
            <Textarea rows={2} placeholder="Mensagem do cliente" value={novo.entrada_usuario}
              onChange={e => setNovo({ ...novo, entrada_usuario: e.target.value })} />
            <Textarea rows={3} placeholder="Como a IA deve responder" value={novo.resposta_ideal}
              onChange={e => setNovo({ ...novo, resposta_ideal: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button size="sm" disabled={upsert.isPending} onClick={async () => {
                if (!novo.titulo || !novo.entrada_usuario || !novo.resposta_ideal) return;
                await upsert.mutateAsync({ habilidade_slug: slug, ...novo });
                setNovo({ titulo: '', entrada_usuario: '', resposta_ideal: '' });
                setFormOpen(false);
              }}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar exemplo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {filtrados.map(item => (
          <ExemploCard
            key={item.id}
            item={item}
            slug={slug}
            editing={editingId === item.id}
            onEdit={() => setEditingId(item.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaved={() => setEditingId(null)}
            onDelete={() => setConfirmDelete(item)}
          />
        ))}
        {filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {busca ? 'Nenhum exemplo bate com a busca.' : 'Nenhum exemplo cadastrado.'}
          </p>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este exemplo?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.titulo}
              <br /><br />
              A IA deixa de usar este exemplo a partir da próxima mensagem. Atendimentos em andamento não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) del.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExemploCard({
  item, slug, editing, onEdit, onCancelEdit, onSaved, onDelete,
}: {
  item: IAExemplo;
  slug: string;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const upsert = useUpsertIAExemplo();
  const [draft, setDraft] = useState({
    titulo: item.titulo,
    entrada_usuario: item.entrada_usuario,
    resposta_ideal: item.resposta_ideal,
  });
  useEffect(() => {
    if (editing) {
      setDraft({ titulo: item.titulo, entrada_usuario: item.entrada_usuario, resposta_ideal: item.resposta_ideal });
    }
  }, [editing, item.id, item.atualizado_em]);

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-3 space-y-2">
          <Input value={draft.titulo} onChange={e => setDraft({ ...draft, titulo: e.target.value })} placeholder="Título" />
          <Textarea rows={2} value={draft.entrada_usuario} onChange={e => setDraft({ ...draft, entrada_usuario: e.target.value })} placeholder="Mensagem do cliente" />
          <Textarea rows={4} value={draft.resposta_ideal} onChange={e => setDraft({ ...draft, resposta_ideal: e.target.value })} placeholder="Como a IA deve responder" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Salvar não interrompe atendimentos em curso.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>Cancelar</Button>
              <Button size="sm" disabled={upsert.isPending}
                onClick={async () => {
                  await upsert.mutateAsync({
                    id: item.id,
                    habilidade_slug: slug,
                    titulo: draft.titulo,
                    entrada_usuario: draft.entrada_usuario,
                    resposta_ideal: draft.resposta_ideal,
                  });
                  onSaved();
                }}
              >
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-3 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> {item.titulo}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="Remover">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground"><strong>Cliente:</strong> {item.entrada_usuario}</div>
        <div className="text-xs text-muted-foreground whitespace-pre-wrap"><strong>IA:</strong> {item.resposta_ideal}</div>
      </CardContent>
    </Card>
  );
}
