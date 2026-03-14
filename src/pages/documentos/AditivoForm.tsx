import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAditivo, useCreateAditivo, useUpdateAditivo, type RegraAditivo } from '@/hooks/useAditivos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Car, DollarSign, ExternalLink, GripVertical, GlassWater, Shield, MapPin, Smartphone, Wrench, Fuel, Clock, Truck, ShieldCheck, Ambulance } from 'lucide-react';
import { formatCurrency } from '@/types/termo-filiacao';
import { TemplateEditor, getTemplateEditor } from '@/components/documentos/TemplateEditor';
import { VariaveisSelector } from '@/components/documentos/VariaveisSelector';

const TIPOS_REGRA = [
  // --- Regras por característica do veículo ---
  { tipo: 'veiculo_0km' as const, label: 'Veículo 0KM', desc: 'Identificado automaticamente via CRLV (sem placa ou procedência "Novo")', icon: Car, grupo: 'veiculo' },
  { tipo: 'fipe_acima_de' as const, label: 'Valor FIPE acima do limite', desc: 'Valor configurável nas configurações do diretor', icon: DollarSign, grupo: 'veiculo' },
  { tipo: 'veiculo_blindado' as const, label: 'Veículo Blindado', desc: 'Detectado automaticamente via OCR do CRLV (campo observações)', icon: Shield, grupo: 'veiculo' },
  { tipo: 'rastreador_obrigatorio' as const, label: 'Rastreador Obrigatório', desc: 'Passeio FIPE ≥ R$ 30k, moto FIPE ≥ R$ 9k ou diesel — limites configuráveis', icon: MapPin, grupo: 'veiculo' },
  { tipo: 'rastreador_movel' as const, label: 'Rastreador Móvel (provisório)', desc: 'Quando a instalação do rastreador fixo não será feita no mesmo dia', icon: Truck, grupo: 'veiculo' },
  { tipo: 'veiculo_aplicativo' as const, label: 'Veículo de Aplicativo', desc: 'Uso marcado como Táxi/Uber/Aplicativo — rateio e cota diferenciados', icon: Smartphone, grupo: 'veiculo' },
  // --- Regras por benefício contratado ---
  { tipo: 'beneficio_vidros' as const, label: 'Proteção Vidros e Faróis', desc: 'Consultor marcou o benefício na proposta (carência 120 dias, 40/60%)', icon: GlassWater, grupo: 'beneficio' },
  { tipo: 'beneficio_kit_gas' as const, label: 'Proteção Kit Gás', desc: 'Consultor marcou o benefício na proposta (reembolso R$ 1.500 em caso de roubo/furto sem recuperação)', icon: Fuel, grupo: 'beneficio' },
  { tipo: 'beneficio_danos_terceiros' as const, label: 'Danos a Terceiros', desc: 'Consultor selecionou faixa (R$ 15k / 40k / 70k / 100k)', icon: ShieldCheck, grupo: 'beneficio' },
  { tipo: 'beneficio_carro_reserva' as const, label: 'Carro Reserva', desc: 'Consultor selecionou duração (7, 15 ou 30 dias — reembolso até R$ 2.200)', icon: Car, grupo: 'beneficio' },
  { tipo: 'beneficio_reboque_excedente' as const, label: 'Reboque Excedente', desc: 'Consultor marcou benefício (2 acionamentos extras/ano, mín. 6 meses entre eles)', icon: Wrench, grupo: 'beneficio' },
  { tipo: 'beneficio_carencia_zero' as const, label: 'Carência Zero', desc: 'Consultor marcou e pagamento confirmado — isenta período de espera', icon: Clock, grupo: 'beneficio' },
  // --- Regra por evento ---
  { tipo: 'evento_vidros' as const, label: 'Evento Vidros e Faróis', desc: 'Anexado automaticamente quando o sinistro for do tipo vidros e faróis', icon: GlassWater, grupo: 'evento' },
];

export default function AditivoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id && id !== 'novo';

  const { data: aditivo, isLoading } = useAditivo(isEditing ? id : undefined);
  const createMutation = useCreateAditivo();
  const updateMutation = useUpdateAditivo();

  const { data: fipeLimite } = useQuery({
    queryKey: ['config-aditivo-fipe-limite'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'aditivo_fipe_limite')
        .single();
      return data ? Number(data.valor) : 100000;
    },
  });

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [conteudoHtml, setConteudoHtml] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [ordem, setOrdem] = useState(0);
  const [regras, setRegras] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    TIPOS_REGRA.forEach(t => { initial[t.tipo] = false; });
    return initial;
  });

  useEffect(() => {
    if (aditivo) {
      setNome(aditivo.nome);
      setDescricao(aditivo.descricao || '');
      setConteudoHtml(aditivo.conteudo_html || '');
      setAtivo(aditivo.ativo);
      setOrdem(aditivo.ordem);
      const regrasMap: Record<string, boolean> = {};
      TIPOS_REGRA.forEach(t => { regrasMap[t.tipo] = false; });
      (aditivo.regras || []).forEach((r: RegraAditivo) => {
        regrasMap[r.tipo] = r.ativo;
      });
      setRegras(regrasMap);
    }
  }, [aditivo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const regrasArray: RegraAditivo[] = TIPOS_REGRA
      .filter(t => regras[t.tipo])
      .map(t => ({
        tipo: t.tipo,
        ativo: true,
        ...(t.tipo === 'fipe_acima_de' ? { valor_config: 'aditivo_fipe_limite' } : {}),
      }));

    const payload = {
      nome,
      descricao: descricao || null,
      conteudo_html: conteudoHtml || null,
      ativo,
      ordem,
      regras: regrasArray,
    };

    if (isEditing) {
      await updateMutation.mutateAsync({ id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    navigate('/documentos/aditivos');
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoading) {
    return <div className="p-6 space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/documentos/aditivos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? 'Editar Aditivo' : 'Novo Aditivo'}</h1>
          <p className="text-muted-foreground">Configure o aditivo e suas regras de anexação</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Termo Aditivo 0KM" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição breve do aditivo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem</Label>
                <Input id="ordem" type="number" value={ordem} onChange={e => setOrdem(Number(e.target.value))} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={ativo} onCheckedChange={setAtivo} />
                <Label>{ativo ? 'Ativo' : 'Inativo'}</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Conteúdo do Aditivo</CardTitle></CardHeader>
          <CardContent>
            <div className="grid lg:grid-cols-[1fr_280px] gap-4">
              <TemplateEditor
                value={conteudoHtml}
                onChange={setConteudoHtml}
                placeholder="Digite o conteúdo do aditivo aqui... Use {{variavel}} para inserir variáveis dinâmicas."
              />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  Arraste ou clique para inserir
                </p>
                <VariaveisSelector onSelect={(variavel) => {
                  const ed = getTemplateEditor();
                  if (ed && ed.isEditable) {
                    ed.chain().focus().insertContent(variavel).run();
                  }
                }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Regras de Anexação Automática</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Marque as condições que devem estar presentes para este aditivo ser anexado automaticamente ao contrato.
            </p>

            {/* Grupo: Veículo */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Por Característica do Veículo</p>
              {TIPOS_REGRA.filter(t => t.grupo === 'veiculo').map(({ tipo, label, desc, icon: Icon }) => (
                <div key={tipo} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Checkbox
                    checked={regras[tipo]}
                    onCheckedChange={(checked) => setRegras(prev => ({ ...prev, [tipo]: !!checked }))}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    {tipo === 'fipe_acima_de' && fipeLimite && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs">Valor atual: <strong>{formatCurrency(fipeLimite)}</strong></span>
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                          <a href="/diretoria/configuracoes" target="_blank">
                            Editar <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Grupo: Benefício */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Por Benefício Contratado</p>
              {TIPOS_REGRA.filter(t => t.grupo === 'beneficio').map(({ tipo, label, desc, icon: Icon }) => (
                <div key={tipo} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Checkbox
                    checked={regras[tipo]}
                    onCheckedChange={(checked) => setRegras(prev => ({ ...prev, [tipo]: !!checked }))}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Grupo: Evento */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Por Tipo de Evento/Sinistro</p>
              {TIPOS_REGRA.filter(t => t.grupo === 'evento').map(({ tipo, label, desc, icon: Icon }) => (
                <div key={tipo} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Checkbox
                    checked={regras[tipo]}
                    onCheckedChange={(checked) => setRegras(prev => ({ ...prev, [tipo]: !!checked }))}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/documentos/aditivos')}>Cancelar</Button>
          <Button type="submit" disabled={isSaving || !nome}>
            {isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Aditivo'}
          </Button>
        </div>
      </form>
    </div>
  );
}
