import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Save, ChevronDown, AlertTriangle, CheckCircle, Info, History } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SCORE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  baixo: { bg: 'bg-green-100', text: 'text-green-800', icon: '🟢' },
  atencao: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '🟡' },
  alto: { bg: 'bg-red-100', text: 'text-red-800', icon: '🔴' },
};

export default function ConsultaAntecedentes() {
  const queryClient = useQueryClient();
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [nome, setNome] = useState('');
  const [resultadoManual, setResultadoManual] = useState('');
  const [resultado, setResultado] = useState<any>(null);

  // Histórico de pesquisas
  const { data: historico = [] } = useQuery({
    queryKey: ['pesquisas-antecedentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesquisas_antecedentes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Pesquisar via edge function
  const pesquisarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('pesquisar-antecedentes', {
        body: { cpf_cnpj: cpfCnpj.replace(/\D/g, ''), nome },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setResultado(data);
      toast.success('Pesquisa concluída!');
    },
    onError: (error: any) => {
      if (error?.message?.includes('429') || error?.status === 429) {
        toast.error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      } else if (error?.message?.includes('402') || error?.status === 402) {
        toast.error('Créditos insuficientes para pesquisa de IA.');
      } else {
        toast.error('Erro na pesquisa: ' + (error?.message || 'Erro desconhecido'));
      }
    },
  });

  // Salvar relatório
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const resultadoFinal = resultado || {};
      if (resultadoManual) {
        resultadoFinal.resultado_manual = resultadoManual;
      }
      const { error } = await supabase.from('pesquisas_antecedentes').insert({
        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        nome,
        resultado: resultadoFinal,
        score_risco: resultado?.score_risco || 'baixo',
        pesquisado_por: user?.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pesquisas-antecedentes'] });
      toast.success('Relatório salvo com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const score = resultado?.score_risco || null;
  const scoreInfo = score ? SCORE_COLORS[score] : null;

  return (
    <div className="space-y-6">
      {/* Formulário de pesquisa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Pesquisar Antecedentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>CPF ou CNPJ *</Label>
              <Input
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
              />
            </div>
            <div>
              <Label>Nome completo *</Label>
              <Input
                placeholder="Nome da pessoa ou empresa"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={() => pesquisarMutation.mutate()}
            disabled={!cpfCnpj || !nome || pesquisarMutation.isPending}
          >
            <Search className="h-4 w-4 mr-2" />
            {pesquisarMutation.isPending ? 'Pesquisando...' : 'Pesquisar Antecedentes'}
          </Button>
        </CardContent>
      </Card>

      {/* Loading */}
      {pesquisarMutation.isPending && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {resultado && !pesquisarMutation.isPending && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Resultado da Pesquisa</CardTitle>
              {scoreInfo && (
                <Badge className={`${scoreInfo.bg} ${scoreInfo.text} text-sm`}>
                  {scoreInfo.icon} Risco {score === 'baixo' ? 'Baixo' : score === 'atencao' ? 'Atenção' : 'Alto'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Seções colapsáveis */}
            {resultado.situacao_cadastral && (
              <ResultadoSecao titulo="Situação Cadastral" icon={<CheckCircle className="h-4 w-4" />}>
                <p className="text-sm whitespace-pre-wrap">{typeof resultado.situacao_cadastral === 'string' ? resultado.situacao_cadastral : JSON.stringify(resultado.situacao_cadastral, null, 2)}</p>
              </ResultadoSecao>
            )}
            {resultado.processos && (
              <ResultadoSecao titulo="Processos Judiciais Públicos" icon={<AlertTriangle className="h-4 w-4" />}>
                <p className="text-sm whitespace-pre-wrap">{typeof resultado.processos === 'string' ? resultado.processos : JSON.stringify(resultado.processos, null, 2)}</p>
              </ResultadoSecao>
            )}
            {resultado.protestos && (
              <ResultadoSecao titulo="Protestos" icon={<AlertTriangle className="h-4 w-4" />}>
                <p className="text-sm whitespace-pre-wrap">{typeof resultado.protestos === 'string' ? resultado.protestos : JSON.stringify(resultado.protestos, null, 2)}</p>
              </ResultadoSecao>
            )}
            {resultado.redes_sociais && (
              <ResultadoSecao titulo="Redes Sociais Públicas" icon={<Info className="h-4 w-4" />}>
                <p className="text-sm whitespace-pre-wrap">{typeof resultado.redes_sociais === 'string' ? resultado.redes_sociais : JSON.stringify(resultado.redes_sociais, null, 2)}</p>
              </ResultadoSecao>
            )}
            {resultado.noticias && (
              <ResultadoSecao titulo="Notícias" icon={<Info className="h-4 w-4" />}>
                <p className="text-sm whitespace-pre-wrap">{typeof resultado.noticias === 'string' ? resultado.noticias : JSON.stringify(resultado.noticias, null, 2)}</p>
              </ResultadoSecao>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resultado Manual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resultado Manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Cole aqui resultados de pesquisas externas..."
            value={resultadoManual}
            onChange={(e) => setResultadoManual(e.target.value)}
            rows={4}
          />
          <Button
            variant="outline"
            onClick={() => salvarMutation.mutate()}
            disabled={(!resultado && !resultadoManual) || !cpfCnpj || !nome || salvarMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {salvarMutation.isPending ? 'Salvando...' : 'Salvar Relatório'}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico */}
      {historico.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Pesquisas Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historico.map((h: any) => {
                const sc = h.score_risco ? SCORE_COLORS[h.score_risco] : null;
                return (
                  <div key={h.id} className="flex items-center justify-between p-2 rounded border text-sm cursor-pointer hover:bg-accent/50" onClick={() => {
                    setCpfCnpj(h.cpf_cnpj);
                    setNome(h.nome);
                    setResultado(h.resultado);
                    setResultadoManual(h.resultado?.resultado_manual || '');
                  }}>
                    <div>
                      <strong>{h.nome}</strong> — {h.cpf_cnpj}
                      <span className="text-muted-foreground ml-2">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    {sc && <Badge className={`${sc.bg} ${sc.text}`}>{sc.icon} {h.score_risco}</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultadoSecao({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-2 font-medium text-sm">{icon} {titulo}</div>
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
