import { useEffect, useState } from 'react';
import { Bot, Power, Sparkles, Save, Plus, Trash2, AlertTriangle, Clock, Loader2, ShieldOff } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import {
  useIAHabilidades, useToggleIAHabilidade, useUpsertIAHabilidade,
  useIAConhecimento, useUpsertIAConhecimento, useDeleteIAConhecimento,
  useIAExemplos, useUpsertIAExemplo, useDeleteIAExemplo,
  type IAHabilidade,
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

  // Lê o kill-switch geral (whatsapp_instancias.ia_habilitada) — quando off,
  // a habilidade fica bloqueada em runtime mesmo se o switch local estiver on.
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
            Personalidade, conhecimento (FAQ), exemplos de resposta e ferramentas da IA que atende associados no WhatsApp.
          </p>
        </div>
      </div>

      {killSwitchOff && (
        <Alert variant="destructive">
          <ShieldOff className="h-4 w-4" />
          <AlertDescription>
            A IA está <strong>desligada por completo</strong> no painel de integrações
            (admin). Enquanto isso, esta habilidade fica bloqueada em runtime — mesmo se
            o switch abaixo estiver ligado. O estado individual é preservado e será
            respeitado assim que o desligamento geral for revertido.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Esta IA atende <strong>associados</strong> 24/7 (atendimento receptivo).
          Quando desligada aqui, mensagens entrando no WhatsApp ficam aguardando atendimento humano (com aviso ao cliente).
          Pedidos fora do escopo (cotação de novo veículo, RH, imprensa, etc.) são <strong>direcionados</strong> via itens da
          categoria <code>direcionamento</code> na aba <em>Conhecimento (FAQ)</em> — preencha o destino real antes de ativar cada item.
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
  const [form, setForm] = useState<IAHabilidade>(habilidade);
  useEffect(() => { setForm(habilidade); }, [habilidade.slug, habilidade.atualizado_em]);

  const toggle = useToggleIAHabilidade();
  const upsert = useUpsertIAHabilidade();

  const handleSave = () => upsert.mutate(form);

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <Card className={form.ativa ? '' : 'border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Power className={`h-5 w-5 ${form.ativa ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              <div>
                <CardTitle className="text-base">IA de Atendimento</CardTitle>
                <CardDescription>
                  {form.ativa
                    ? 'Respondendo automaticamente no WhatsApp.'
                    : 'Desligada — mensagens vão direto para atendimento humano.'}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Switch
                checked={form.ativa}
                onCheckedChange={(ativa) => {
                  setForm({ ...form, ativa });
                  toggle.mutate({ slug: form.slug, ativa });
                }}
                disabled={toggle.isPending}
              />
              <span className="text-xs text-muted-foreground">{form.ativa ? 'Ativa' : 'Desligada'}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="identidade">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="identidade">Identidade & Regras</TabsTrigger>
              <TabsTrigger value="conhecimento">Conhecimento (FAQ)</TabsTrigger>
              <TabsTrigger value="exemplos">Exemplos</TabsTrigger>
              <TabsTrigger value="ferramentas">Ferramentas & Horário</TabsTrigger>
            </TabsList>

            <TabsContent value="identidade" className="space-y-4 mt-4">
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
              <Separator />
              <div>
                <Label>Persona</Label>
                <Textarea rows={3} value={form.persona} onChange={e => setForm({ ...form, persona: e.target.value })}
                  placeholder="Como a IA se comporta e se posiciona" />
              </div>
              <div>
                <Label>Regras absolutas</Label>
                <Textarea rows={4} value={form.regras_absolutas} onChange={e => setForm({ ...form, regras_absolutas: e.target.value })}
                  placeholder="Limites inegociáveis (ex.: nunca prometer ação humana sem chamar transbordo)" />
              </div>
              <div>
                <Label>Tom de voz</Label>
                <Textarea rows={2} value={form.tom_voz} onChange={e => setForm({ ...form, tom_voz: e.target.value })} />
              </div>
              <div>
                <Label>Saudação inicial</Label>
                <Textarea rows={2} value={form.saudacao_inicial} onChange={e => setForm({ ...form, saudacao_inicial: e.target.value })} />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={upsert.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Salvar identidade
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="conhecimento" className="mt-4">
              <ConhecimentoTab slug={form.slug} />
            </TabsContent>

            <TabsContent value="exemplos" className="mt-4">
              <ExemplosTab slug={form.slug} />
            </TabsContent>

            <TabsContent value="ferramentas" className="space-y-5 mt-4">
              <div>
                <Label>Ferramentas que esta IA pode usar</Label>
                <div className="space-y-1.5 mt-2">
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

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Horário de atendimento (vazio = 24/7)
                </Label>
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
                  <Save className="h-4 w-4 mr-2" /> Salvar ferramentas & horário
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ConhecimentoTab({ slug }: { slug: string }) {
  const { data: itens = [] } = useIAConhecimento(slug);
  const upsert = useUpsertIAConhecimento();
  const del = useDeleteIAConhecimento();
  const [novo, setNovo] = useState({ pergunta: '', resposta: '', categoria: 'geral' });

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Input placeholder="Categoria (ex: boletos, cancelamento)" value={novo.categoria}
            onChange={e => setNovo({ ...novo, categoria: e.target.value })} />
          <Input placeholder="Pergunta / gatilho" value={novo.pergunta}
            onChange={e => setNovo({ ...novo, pergunta: e.target.value })} />
          <Textarea rows={3} placeholder="Resposta que a IA deve dar" value={novo.resposta}
            onChange={e => setNovo({ ...novo, resposta: e.target.value })} />
          <Button size="sm" onClick={async () => {
            if (!novo.pergunta || !novo.resposta) return;
            await upsert.mutateAsync({ habilidade_slug: slug, ...novo });
            setNovo({ pergunta: '', resposta: '', categoria: 'geral' });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar ao FAQ
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {itens.map(i => (
          <Card key={i.id} className={i.revisar ? 'border-amber-500/40' : ''}>
            <CardContent className="pt-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{i.categoria}</Badge>
                  {i.revisar && <Badge variant="outline" className="text-xs text-amber-600">revisar</Badge>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-sm font-medium">{i.pergunta}</div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{i.resposta}</div>
            </CardContent>
          </Card>
        ))}
        {itens.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum item de FAQ cadastrado.</p>
        )}
      </div>
    </div>
  );
}

function ExemplosTab({ slug }: { slug: string }) {
  const { data: itens = [] } = useIAExemplos(slug);
  const upsert = useUpsertIAExemplo();
  const del = useDeleteIAExemplo();
  const [novo, setNovo] = useState({ titulo: '', entrada_usuario: '', resposta_ideal: '' });

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Input placeholder="Título" value={novo.titulo}
            onChange={e => setNovo({ ...novo, titulo: e.target.value })} />
          <Textarea rows={2} placeholder="Mensagem do cliente" value={novo.entrada_usuario}
            onChange={e => setNovo({ ...novo, entrada_usuario: e.target.value })} />
          <Textarea rows={3} placeholder="Como a IA deve responder" value={novo.resposta_ideal}
            onChange={e => setNovo({ ...novo, resposta_ideal: e.target.value })} />
          <Button size="sm" onClick={async () => {
            if (!novo.titulo || !novo.entrada_usuario || !novo.resposta_ideal) return;
            await upsert.mutateAsync({ habilidade_slug: slug, ...novo });
            setNovo({ titulo: '', entrada_usuario: '', resposta_ideal: '' });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar exemplo
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {itens.map(i => (
          <Card key={i.id}>
            <CardContent className="pt-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> {i.titulo}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground"><strong>Cliente:</strong> {i.entrada_usuario}</div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap"><strong>IA:</strong> {i.resposta_ideal}</div>
            </CardContent>
          </Card>
        ))}
        {itens.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum exemplo cadastrado.</p>
        )}
      </div>
    </div>
  );
}
