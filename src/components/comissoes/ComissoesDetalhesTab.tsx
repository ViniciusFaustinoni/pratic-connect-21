import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/UserAvatar';
import { User, Calendar, Target, DollarSign, Award, TrendingUp, Percent } from 'lucide-react';
import type { Comissao, Deducao } from '@/types/comissoes';
import type { VendedorResumo, DeducaoMensal } from '@/hooks/useComissoesExtended';
import { TIPO_COMISSAO_LABELS, TIPO_DEDUCAO_LABELS } from '@/types/comissoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsultores } from '@/hooks/useConsultores';

interface ComissoesDetalhesTabProps {
  resumoVendedores: VendedorResumo[];
  deducoesMensal: DeducaoMensal[];
  comissoes: Comissao[];
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

interface ComissaoCardProps {
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
  items: Array<{ label: string; value: string | number }>;
  valorTotal: number;
  naoAplicavel?: boolean;
}

function ComissaoDetailCard({ 
  title, 
  icon, 
  bgColor, 
  iconColor, 
  items, 
  valorTotal,
  naoAplicavel = false,
}: ComissaoCardProps) {
  return (
    <Card className={bgColor}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {naoAplicavel ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            N/A para este tipo de consultor
          </div>
        ) : (
          <>
            <div className="space-y-1 mb-3">
              {items.map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="font-bold text-primary">{formatCurrency(valorTotal)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ComissoesDetalhesTab({
  resumoVendedores,
  deducoesMensal,
  comissoes,
  isLoading,
}: ComissoesDetalhesTabProps) {
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('');
  const { data: consultores, isLoading: isLoadingConsultores } = useConsultores();

  const selectedVendedor = useMemo(() => {
    // Primeiro tenta encontrar nos dados de comissões existentes
    const fromResumo = resumoVendedores.find(v => v.vendedor_id === selectedVendedorId);
    if (fromResumo) return fromResumo;
    
    // Se não encontrou, busca nos consultores e retorna estrutura zerada
    const consultor = consultores?.find(c => c.id === selectedVendedorId);
    if (!consultor) return null;
    
    return {
      vendedor_id: consultor.id,
      vendedor_nome: consultor.nome,
      vendedor_avatar: consultor.avatar_url,
      tipo_consultor: consultor.roles.includes('vendedor_externo') ? 'externo' : 'interno',
      total_adesao: 0,
      total_recorrente: 0,
      total_producao: 0,
      total_classificacao: 0,
      total_crescimento: 0,
      total_recorde: 0,
      total_geral: 0,
      vendas_confirmadas: 0,
    };
  }, [resumoVendedores, consultores, selectedVendedorId]);

  const vendedorDeducoes = useMemo(() => {
    return deducoesMensal.filter(d => d.vendedor_id === selectedVendedorId);
  }, [deducoesMensal, selectedVendedorId]);

  const vendedorComissoes = useMemo(() => {
    return comissoes.filter(c => c.vendedor_id === selectedVendedorId);
  }, [comissoes, selectedVendedorId]);

  const totalDeducoes = vendedorDeducoes.reduce((sum, d) => sum + d.valor, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seletor de vendedor */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedVendedorId} onValueChange={setSelectedVendedorId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                {consultores?.filter(c => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        src={c.avatar_url || undefined}
                        name={c.nome}
                        size="sm"
                      />
                      {c.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedVendedor && (
        <>
          {/* Card de identificação */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <UserAvatar
                  src={selectedVendedor.vendedor_avatar || undefined}
                  name={selectedVendedor.vendedor_nome}
                  size="lg"
                />
                <div>
                  <h3 className="text-lg font-semibold">{selectedVendedor.vendedor_nome}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={selectedVendedor.tipo_consultor === 'interno' ? 'default' : 'secondary'}>
                      {selectedVendedor.tipo_consultor === 'interno' ? 'Consultor Interno' : 'Consultor Externo'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {selectedVendedor.vendas_confirmadas} vendas no mês
                    </span>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-sm text-muted-foreground">Total do Mês</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(selectedVendedor.total_geral)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid de cards por tipo de comissão */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ComissaoDetailCard
              title="Bonificação Adesão"
              icon={<DollarSign className="h-4 w-4" />}
              bgColor="bg-blue-50/50 dark:bg-blue-950/20"
              iconColor="text-blue-600"
              items={[
                { label: 'Vendas', value: selectedVendedor.vendas_confirmadas },
                { label: 'Percentual', value: '-' },
              ]}
              valorTotal={selectedVendedor.total_adesao}
            />

            <ComissaoDetailCard
              title="Recorrente"
              icon={<Percent className="h-4 w-4" />}
              bgColor="bg-green-50/50 dark:bg-green-950/20"
              iconColor="text-green-600"
              items={[
                { label: 'Placas Ativas', value: '-' },
                { label: 'Boletos Pagos', value: '-' },
              ]}
              valorTotal={selectedVendedor.total_recorrente}
            />

            <ComissaoDetailCard
              title="Produção"
              icon={<Target className="h-4 w-4" />}
              bgColor="bg-purple-50/50 dark:bg-purple-950/20"
              iconColor="text-purple-600"
              items={[
                { label: 'Placas Confirmadas', value: selectedVendedor.vendas_confirmadas },
              ]}
              valorTotal={selectedVendedor.total_producao}
              naoAplicavel={selectedVendedor.tipo_consultor === 'interno'}
            />

            <ComissaoDetailCard
              title="Classificação"
              icon={<Award className="h-4 w-4" />}
              bgColor="bg-orange-50/50 dark:bg-orange-950/20"
              iconColor="text-orange-600"
              items={[
                { label: 'Posição', value: '-' },
              ]}
              valorTotal={selectedVendedor.total_classificacao}
            />

            <ComissaoDetailCard
              title="Crescimento"
              icon={<TrendingUp className="h-4 w-4" />}
              bgColor="bg-cyan-50/50 dark:bg-cyan-950/20"
              iconColor="text-cyan-600"
              items={[
                { label: 'Último Marco', value: '-' },
                { label: 'Próximo Marco', value: '-' },
              ]}
              valorTotal={selectedVendedor.total_crescimento}
            />

            <ComissaoDetailCard
              title="Recorde"
              icon={<Calendar className="h-4 w-4" />}
              bgColor="bg-yellow-50/50 dark:bg-yellow-950/20"
              iconColor="text-yellow-600"
              items={[
                { label: 'Recorde Anterior', value: '-' },
                { label: 'Vendas do Mês', value: selectedVendedor.vendas_confirmadas },
              ]}
              valorTotal={selectedVendedor.total_recorde}
            />
          </div>

          {/* Tabela de deduções */}
          {vendedorDeducoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Deduções do Mês ({vendedorDeducoes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedorDeducoes.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {TIPO_DEDUCAO_LABELS[d.tipo] || d.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.descricao || '-'}
                        </TableCell>
                        <TableCell className="text-right text-destructive font-medium">
                          -{formatCurrency(d.valor)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(d.aplicada_em), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">Total Deduções</TableCell>
                      <TableCell className="text-right text-destructive font-bold">
                        -{formatCurrency(totalDeducoes)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Tabela de comissões por contrato */}
          {vendedorComissoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Comissões por Contrato ({vendedorComissoes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Associado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor Base</TableHead>
                      <TableHead className="text-right">Deduções</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedorComissoes.slice(0, 20).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">
                          {c.contrato?.numero || c.contrato_id?.slice(0, 8)}
                        </TableCell>
                        <TableCell>{c.contrato?.associado?.nome || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {TIPO_COMISSAO_LABELS[c.tipo_comissao as keyof typeof TIPO_COMISSAO_LABELS] || c.tipo_comissao}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(c.valor_base)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {c.valor_deducoes ? `-${formatCurrency(c.valor_deducoes)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCurrency(c.valor_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {vendedorComissoes.length > 20 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Exibindo 20 de {vendedorComissoes.length} comissões
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedVendedorId && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Selecione um vendedor para ver os detalhes</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
