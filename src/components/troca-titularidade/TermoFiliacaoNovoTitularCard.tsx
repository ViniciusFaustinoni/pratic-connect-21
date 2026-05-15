import { useQuery } from '@tanstack/react-query';
import { FileSignature, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  cotacaoId?: string | null;
}

/**
 * Mostra o Termo de Filiação (contrato do NOVO titular) gerado a partir da
 * cotação vinculada à troca de titularidade. Disponibiliza link para o PDF
 * assinado (Autentique) e o link da assinatura.
 */
export function TermoFiliacaoNovoTitularCard({ cotacaoId }: Props) {
  const { data: contrato, isLoading } = useQuery({
    queryKey: ['contrato-troca-by-cotacao', cotacaoId],
    enabled: !!cotacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id, numero, status, autentique_url, pdf_assinado_url, pdf_url, data_assinatura')
        .eq('cotacao_id', cotacaoId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!cotacaoId) return null;

  return (
    <div className="rounded border p-3 space-y-2">
      <h4 className="font-semibold flex items-center gap-2">
        <FileSignature className="h-4 w-4" /> Termo de Filiação (novo titular)
      </h4>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando contrato…
        </p>
      ) : !contrato ? (
        <p className="text-sm text-muted-foreground">
          O contrato será gerado quando o novo titular concluir o link público (escolha de plano e assinatura).
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-mono">{contrato.numero}</span>
            <Badge variant={contrato.status === 'assinado' || contrato.status === 'ativo' ? 'default' : 'secondary'}>
              {contrato.status}
            </Badge>
          </div>

          {contrato.data_assinatura && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Assinado em {new Date(contrato.data_assinatura).toLocaleString('pt-BR')}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {contrato.pdf_assinado_url && (
              <Button asChild size="sm" variant="outline">
                <a href={contrato.pdf_assinado_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" /> PDF assinado
                </a>
              </Button>
            )}
            {!contrato.pdf_assinado_url && contrato.pdf_url && (
              <Button asChild size="sm" variant="outline">
                <a href={contrato.pdf_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" /> PDF
                </a>
              </Button>
            )}
            {contrato.autentique_url && (
              <Button asChild size="sm" variant="outline">
                <a href={contrato.autentique_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir no Autentique
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
