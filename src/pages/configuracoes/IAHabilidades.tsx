import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Power, BookOpen, Sparkles, Settings2, Clock, Wrench, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  useIAHabilidades, useToggleIAHabilidade, useUpsertIAHabilidade,
  useIAConhecimento, useUpsertIAConhecimento, useDeleteIAConhecimento,
  useIAExemplos, useUpsertIAExemplo, useDeleteIAExemplo,
  type IAHabilidade, type IAConhecimento, type IAExemplo,
} from '@/hooks/useIAHabilidades';

const TOOLS_CATALOG: { name: string; descricao: string }[] = [
  { name: 'consultar_placa', descricao: 'Consulta placa na FIPE' },
  { name: 'calcular_cotacao', descricao: 'Calcula cotação com regras de elegibilidade' },
  { name: 'registrar_cotacao', descricao: 'Salva cotação e gera link' },
  { name: 'obter_opcoes_vencimento', descricao: 'Lista dias de vencimento disponíveis' },
  { name: 'salvar_dados_cliente', descricao: 'Persiste dados do cliente' },
  { name: 'consultar_boletos_associado', descricao: 'Consulta boletos no SGA' },
  { name: 'solicitar_atendente_humano', descricao: 'Escala para humano (transbordo)' },
];

const AUDIENCIAS = ['lead', 'associado', 'diretor'] as const;

export default function IAHabilidades() {
  const navigate = useNavigate();
  const { data: habilidades = [], isLoading } = useIAHabilidades();
  const [editando, setEditando] = useState<IAHabilidade | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes/integracoes/ia')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Habilidades da IA</h1>
            <p className="text-sm text-muted-foreground">
              Cada habilidade é uma caixa fechada: regras, conhecimento, ferramentas e liga/desliga próprios.
            </p>
          </div>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          O liga/desliga aqui é <strong>por habilidade</strong>. Desligar uma habilidade não afeta a outra.
          O master switch global continua em <em>Configurações › Integrações › WhatsApp › IA &amp; Respostas</em>.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {habilidades.map(h => <HabilidadeCard key={h.slug} h={h} onEdit={() => setEditando(h)} />)}
        </div>
      )}

      {editando && (
        <EditarHabilidadeDialog
          habilidade={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function HabilidadeCard({ h, onEdit }: { h: IAHabilidade; onEdit: () => void }) {
  const toggle = useToggleIAHabilidade();
  return (
    <Card className={h.ativa ? '' : 'opacity-60'}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {h.nome_exibicao}
            </CardTitle>
            <CardDescription className="mt-1">{h.descricao}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Switch
              checked={h.ativa}
              onCheckedChange={(ativa) => toggle.mutate({ slug: h.slug, ativa })}
              disabled={toggle.isPending}
            />
            <span className="text-xs text-muted-foreground">{h.ativa ? 'Ativa' : 'Desligada'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {h.audiencias_elegiveis.map(a => (
            <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {h.ferramentas_habilitadas.slice(0, 4).map(t => (
            <Badge key={t} variant="outline" className="text-xs font-mono">{t}</Badge>
          ))}
          {h.ferramentas_habilitadas.length > 4 && (
            <Badge variant="outline" className="text-xs">+{h.ferramentas_habilitadas.length - 4}</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {h.horario_atendimento
            ? `${(h.horario_atendimento.dias || []).join(', ')} ${h.horario_atendimento.inicio}–${h.horario_atendimento.fim}`
            : '24/7'}
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={onEdit}>
          <Settings2 className="h-3.5 w-3.5 mr-2" /> Editar habilidade
        </Button>
      </CardContent>
    </Card>
  );
}

function EditarHabilidadeDialog({ habilidade, onClose }: { habilidade: IAHabilidade; onClose: () => void }) {
  const [form, setForm] = useState<IAHabilidade>(habilidade);
  const upsert = useUpsertIAHabilidade();

  const handleSave = async () => {
    await upsert.mutateAsync(form);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Habilidade: {form.nome_exibicao}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="persona" className="mt-2">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="persona">Persona</TabsTrigger>
            <TabsTrigger value="audiencia">Audiências</TabsTrigger>
            <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>
            <TabsTrigger value="conhecimento">Conhecimento</TabsTrigger>
            <TabsTrigger value="exemplos">Exemplos</TabsTrigger>
          </TabsList>

          <TabsContent value="persona" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome de exibição</Label>
                <Input value={form.nome_exibicao} onChange={e => setForm({ ...form, nome_exibicao: e.target.value })} />
              </div>
              <div>
                <Label>Nome do agente</Label>
                <Input value={form.nome_agente} onChange={e => setForm({ ...form, nome_agente: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
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
          </TabsContent>

          <TabsContent value="audiencia" className="space-y-4 mt-4">
            <div>
              <Label>Audiências que esta habilidade aceita atender</Label>
              <div className="flex gap-2 mt-2">
                {AUDIENCIAS.map(a => {
                  const on = form.audiencias_elegiveis.includes(a);
                  return (
                    <Button
                      key={a}
                      type="button"
                      variant={on ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setForm({
                        ...form,
                        audiencias_elegiveis: on
                          ? form.audiencias_elegiveis.filter(x => x !== a)
                          : [...form.audiencias_elegiveis, a],
                      })}
                    >{a}</Button>
                  );
                })}
              </div>
            </div>
            <Separator />
            <div>
              <Label>Prioridade de roteamento (menor = preferido em desempate)</Label>
              <Input type="number" value={form.prioridade_roteamento}
                onChange={e => setForm({ ...form, prioridade_roteamento: Number(e.target.value) })} />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Horário de atendimento (deixe em branco para 24/7)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="início HH:MM" value={form.horario_atendimento?.inicio || ''}
                  onChange={e => setForm({ ...form, horario_atendimento: { ...(form.horario_atendimento || { dias: ['seg','ter','qua','qui','sex'], timezone: 'America/Sao_Paulo' }), inicio: e.target.value } })} />
                <Input placeholder="fim HH:MM" value={form.horario_atendimento?.fim || ''}
                  onChange={e => setForm({ ...form, horario_atendimento: { ...(form.horario_atendimento || { dias: ['seg','ter','qua','qui','sex'], timezone: 'America/Sao_Paulo' }), fim: e.target.value } })} />
              </div>
              <div>
                <Label className="text-xs">Mensagem fora do horário</Label>
                <Textarea rows={2} value={form.mensagem_fora_horario || ''}
                  onChange={e => setForm({ ...form, mensagem_fora_horario: e.target.value })} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, horario_atendimento: null, mensagem_fora_horario: null })}>
                Limpar (= 24/7)
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="ferramentas" className="space-y-2 mt-4">
            <Label>Ferramentas que esta habilidade pode usar</Label>
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
          </TabsContent>

          <TabsContent value="conhecimento" className="mt-4">
            <ConhecimentoTab slug={form.slug} />
          </TabsContent>

          <TabsContent value="exemplos" className="mt-4">
            <ExemplosTab slug={form.slug} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          <Input placeholder="Categoria (ex: boletos)" value={novo.categoria}
            onChange={e => setNovo({ ...novo, categoria: e.target.value })} />
          <Input placeholder="Pergunta / gatilho" value={novo.pergunta}
            onChange={e => setNovo({ ...novo, pergunta: e.target.value })} />
          <Textarea rows={2} placeholder="Resposta" value={novo.resposta}
            onChange={e => setNovo({ ...novo, resposta: e.target.value })} />
          <Button size="sm" onClick={async () => {
            if (!novo.pergunta || !novo.resposta) return;
            await upsert.mutateAsync({ habilidade_slug: slug, ...novo });
            setNovo({ pergunta: '', resposta: '', categoria: 'geral' });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
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
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado.</p>
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
          <Textarea rows={3} placeholder="Resposta ideal" value={novo.resposta_ideal}
            onChange={e => setNovo({ ...novo, resposta_ideal: e.target.value })} />
          <Button size="sm" onClick={async () => {
            if (!novo.titulo || !novo.entrada_usuario || !novo.resposta_ideal) return;
            await upsert.mutateAsync({ habilidade_slug: slug, ...novo });
            setNovo({ titulo: '', entrada_usuario: '', resposta_ideal: '' });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
        {itens.map(i => (
          <Card key={i.id}>
            <CardContent className="pt-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{i.titulo}</div>
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
