import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Car,
  Shield,
  Check,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  MapPin,
  Fuel,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { formatarMoeda, getDescricaoCategoria, type Categoria } from '@/config/pricing';

export default function CotacaoPublica() {
  const { token } = useParams<{ token: string }>();

  const { data: cotacao, isLoading, error } = useQuery({
    queryKey: ['cotacao-publica', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não informado');

      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          planos:planos!plano_id(*)
        `)
        .eq('token_publico', token)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Handle WhatsApp contact
  const handleWhatsApp = () => {
    const mensagem = `Olá! Tenho interesse na cotação ${cotacao?.numero}. Gostaria de mais informações.`;
    const telefone = '5521999999999'; // Número da associação
    window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  // Calculate validity (7 days)
  const isValid = cotacao?.created_at
    ? new Date(cotacao.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 > Date.now()
    : false;

  // Get extras from dados_extras
  const dadosExtras = cotacao?.dados_extras as Record<string, unknown> | null;
  const clienteNome = dadosExtras?.clienteNome as string | undefined;
  const adicionaisNomes = dadosExtras?.adicionaisNomes as string[] | undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !cotacao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Cotação não encontrada</h1>
            <p className="text-muted-foreground">
              Esta cotação não existe ou o link está incorreto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoria = cotacao.categoria as Categoria | null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">PRATIC</h1>
          <p className="text-muted-foreground">Proteção Veicular</p>
        </div>

        {/* Status */}
        {!isValid && (
          <Card className="border-destructive">
            <CardContent className="py-3 flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Esta cotação expirou. Solicite uma nova.</span>
            </CardContent>
          </Card>
        )}

        {/* Cotação Info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Cotação {cotacao.numero}</CardTitle>
              <Badge variant={isValid ? 'default' : 'destructive'}>
                {isValid ? 'Válida' : 'Expirada'}
              </Badge>
            </div>
            {clienteNome && (
              <p className="text-sm text-muted-foreground">
                Preparada para: {clienteNome}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Veículo */}
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Car className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">
                  {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {cotacao.veiculo_ano && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {cotacao.veiculo_ano}
                    </Badge>
                  )}
                  {cotacao.veiculo_combustivel && (
                    <Badge variant="outline" className="text-xs">
                      <Fuel className="h-3 w-3 mr-1" />
                      {cotacao.veiculo_combustivel}
                    </Badge>
                  )}
                  {cotacao.valor_fipe && (
                    <Badge variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      FIPE: {formatarMoeda(cotacao.valor_fipe)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Plano */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Plano {categoria || cotacao.planos?.nome || 'Selecionado'}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {categoria
                  ? getDescricaoCategoria(categoria)
                  : cotacao.planos?.descricao}
              </p>

              {/* Coberturas */}
              <div className="grid gap-2">
                {cotacao.planos?.coberturas?.map((cobertura: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{cobertura}</span>
                  </div>
                ))}
                {!cotacao.planos?.coberturas && categoria && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Proteção contra Colisão</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Proteção contra Roubo e Furto</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Assistência 24 horas</span>
                    </div>
                    {(categoria === 'PREMIUM' || categoria === 'EXCLUSIVE') && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Proteção de Vidros</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>App de Rastreamento</span>
                        </div>
                      </>
                    )}
                    {categoria === 'EXCLUSIVE' && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Carro Reserva (7 dias)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Guincho Ilimitado</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Adicionais */}
              {adicionaisNomes && adicionaisNomes.length > 0 && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                    Adicionais inclusos:
                  </p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                    {adicionaisNomes.join(' • ')}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Valores */}
            <div className="bg-primary/5 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Taxa de Filiação:</span>
                <span className="font-semibold text-lg">
                  {formatarMoeda(cotacao.valor_adesao || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Mensalidade:</span>
                <span className="font-bold text-2xl text-primary">
                  {formatarMoeda(cotacao.valor_cota || 0)}
                </span>
              </div>
              {cotacao.desagio_aplicado && cotacao.desagio_aplicado > 0 && (
                <Badge variant="secondary" className="w-fit">
                  Desconto de {cotacao.desagio_aplicado}% aplicado
                </Badge>
              )}
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Cotação válida por 7 dias a partir de {formatDate(cotacao.created_at)}</span>
              </div>
              {cotacao.cidade && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>Região: {cotacao.regiao || cotacao.cidade}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-center">Gostou da proposta?</h3>

            <Button
              className="w-full"
              size="lg"
              onClick={handleWhatsApp}
              disabled={!isValid}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Falar no WhatsApp
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={!isValid}>
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </Button>
              <Button variant="outline" className="flex-1" disabled={!isValid}>
                <Mail className="h-4 w-4 mr-2" />
                E-mail
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-4">
          <p>© {new Date().getFullYear()} PRATIC - Proteção Veicular</p>
          <p>Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
