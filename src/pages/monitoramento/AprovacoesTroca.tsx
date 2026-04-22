import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Car, ArrowRight, FileSignature } from 'lucide-react';
import { useSolicitacoesTroca, type StatusTroca } from '@/hooks/useSolicitacoesTroca';
import { ModalDetalhesTroca } from '@/components/troca-titularidade/ModalDetalhesTroca';

export default function AprovacoesTroca() {
  const [aba, setAba] = useState<'pendentes'|'em_vistoria'|'aprovadas'|'recusadas'>('pendentes');
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const filtros: Record<typeof aba, StatusTroca[]> = {
    pendentes: ['aguardando_monitoramento'],
    em_vistoria: ['aguardando_vistoria'],
    aprovadas: ['liberada_para_assinatura', 'efetivada'],
    recusadas: ['reprovada_monitoramento'],
  };

  const { data, isLoading } = useSolicitacoesTroca(filtros[aba]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Aprovações
        </h1>
        <p className="text-muted-foreground">Solicitações aprovadas pelo Cadastro aguardando análise final do Monitoramento</p>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="em_vistoria">Em Vistoria</TabsTrigger>
          <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
          <TabsTrigger value="recusadas">Recusadas</TabsTrigger>
        </TabsList>

        <TabsContent value={aba} className="pt-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : !data || data.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma solicitação nesta aba</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {data.map(s => (
                <Card key={s.id} className="hover:shadow-md transition cursor-pointer" onClick={() => setSelecionada(s.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={s.status === 'liberada_para_assinatura' || s.status === 'efetivada' ? 'default' : 'secondary'}>
                            {s.status.replace(/_/g, ' ')}
                          </Badge>
                          {s.termo_cancelamento_assinado_em && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <FileSignature className="h-3 w-3 mr-1" /> Termo assinado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{s.associado_antigo?.nome}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{s.novo_titular_dados?.nome}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Car className="h-3 w-3" />
                          {s.veiculo?.marca} {s.veiculo?.modelo} • Placa {s.veiculo?.placa}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Analisar</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ModalDetalhesTroca
        open={!!selecionada}
        onOpenChange={(o) => !o && setSelecionada(null)}
        solicitacaoId={selecionada}
        modo="monitoramento"
      />
    </div>
  );
}
