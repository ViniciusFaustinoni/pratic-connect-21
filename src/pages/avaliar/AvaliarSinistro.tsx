import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, Send, CheckCircle, FileWarning, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TIPO_LABELS: Record<string, string> = {
  colisao: 'Colisão',
  roubo: 'Roubo',
  furto: 'Furto',
  roubo_furto: 'Roubo/Furto',
  incendio: 'Incêndio',
  fenomenos_naturais: 'Fenômenos Naturais',
  terceiros: 'Terceiros',
  vidros: 'Vidros',
  outros: 'Outros',
};

interface SinistroAvaliacao {
  id: string;
  protocolo: string;
  tipo: string;
  status: string;
  data_parecer: string | null;
  avaliacao_nota: number | null;
  avaliacao_comentario: string | null;
  avaliacao_data: string | null;
}

export default function AvaliarSinistro() {
  const { sinistro_id } = useParams<{ sinistro_id: string }>();
  const queryClient = useQueryClient();
  const [nota, setNota] = useState(0);
  const [hoverNota, setHoverNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);

  // Buscar dados do sinistro
  const { data: sinistro, isLoading, error } = useQuery({
    queryKey: ['sinistro-avaliacao', sinistro_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          id,
          protocolo,
          tipo,
          status,
          data_parecer,
          avaliacao_nota,
          avaliacao_comentario,
          avaliacao_data
        `)
        .eq('id', sinistro_id!)
        .single();

      if (error) throw error;
      return data as SinistroAvaliacao;
    },
    enabled: !!sinistro_id,
  });

  // Verificar se já foi avaliado
  useEffect(() => {
    if (sinistro?.avaliacao_nota) {
      setNota(sinistro.avaliacao_nota);
      setComentario(sinistro.avaliacao_comentario || '');
      setEnviado(true);
    }
  }, [sinistro]);

  // Mutation para enviar avaliação
  const avaliarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('sinistros')
        .update({
          avaliacao_nota: nota,
          avaliacao_comentario: comentario || null,
          avaliacao_data: new Date().toISOString(),
        })
        .eq('id', sinistro_id!);

      if (error) throw error;
    },
    onSuccess: () => {
      setEnviado(true);
      queryClient.invalidateQueries({ queryKey: ['sinistro-avaliacao', sinistro_id] });
      toast.success('Avaliação enviada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !sinistro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileWarning className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-bold mb-2">Sinistro não encontrado</h2>
            <p className="text-muted-foreground">
              O link de avaliação pode ter expirado ou o sinistro não existe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Só permite avaliação para sinistros finalizados
  const statusFinalizados = ['aprovado', 'negado', 'pago', 'encerrado'];
  if (!statusFinalizados.includes(sinistro.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileWarning className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Sinistro em andamento</h2>
            <p className="text-muted-foreground">
              A avaliação só pode ser feita após a conclusão da análise.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Protocolo: {sinistro.protocolo}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {enviado ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Obrigado pela avaliação!</CardTitle>
              <CardDescription>
                Sua opinião nos ajuda a melhorar nossos serviços.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileWarning className="h-10 w-10 text-primary" />
              </div>
              <CardTitle>Avalie a Análise</CardTitle>
              <CardDescription>
                Sinistro {sinistro.protocolo}
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Info do sinistro */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {TIPO_LABELS[sinistro.tipo] || sinistro.tipo}
            </p>
            <p className="font-medium capitalize">
              Resultado: {sinistro.status === 'aprovado' ? '✅ Aprovado' : sinistro.status === 'negado' ? '❌ Negado' : sinistro.status}
            </p>
            {sinistro.data_parecer && (
              <p className="text-xs text-muted-foreground mt-1">
                Parecer em {new Date(sinistro.data_parecer).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>

          {/* Estrelas */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium">
              {enviado ? 'Sua nota:' : 'Como foi nossa análise?'}
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={enviado}
                  className={cn(
                    "p-1 transition-transform",
                    !enviado && "hover:scale-110 active:scale-95"
                  )}
                  onMouseEnter={() => !enviado && setHoverNota(star)}
                  onMouseLeave={() => !enviado && setHoverNota(0)}
                  onClick={() => !enviado && setNota(star)}
                >
                  <Star
                    className={cn(
                      "h-10 w-10 transition-colors",
                      (hoverNota || nota) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            {nota > 0 && (
              <p className="text-sm text-muted-foreground">
                {nota === 1 && 'Muito ruim'}
                {nota === 2 && 'Ruim'}
                {nota === 3 && 'Regular'}
                {nota === 4 && 'Bom'}
                {nota === 5 && 'Excelente!'}
              </p>
            )}
          </div>

          {/* Comentário */}
          {!enviado && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comentário (opcional)
              </label>
              <Textarea
                placeholder="Conte-nos mais sobre sua experiência..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {enviado && comentario && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Seu comentário:</p>
              <p className="text-sm mt-1">{comentario}</p>
            </div>
          )}

          {/* Botão enviar */}
          {!enviado && (
            <Button
              className="w-full"
              size="lg"
              disabled={nota === 0 || avaliarMutation.isPending}
              onClick={() => avaliarMutation.mutate()}
            >
              {avaliarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Avaliação
                </>
              )}
            </Button>
          )}

          {/* Link para app */}
          <div className="text-center">
            <a
              href="/app"
              className="text-sm text-primary hover:underline"
            >
              Acessar o aplicativo
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
