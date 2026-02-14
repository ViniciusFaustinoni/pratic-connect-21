import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useVistoriaEventoDetalhe } from '@/hooks/useVistoriaEventoDetalhe';
import { VistoriaEventoDados } from '@/components/regulador/VistoriaEventoDados';
import { VistoriaEventoMidias } from '@/components/regulador/VistoriaEventoMidias';
import { VistoriaEventoOrcamento } from '@/components/regulador/VistoriaEventoOrcamento';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
};

export default function ExecutarVistoriaEvento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useVistoriaEventoDetalhe(id);

  const [fotosUrls, setFotosUrls] = useState<string[]>(Array(10).fill(''));
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [orcamentoOpen, setOrcamentoOpen] = useState(false);
  const [iniciando, setIniciando] = useState(false);

  // Sync existing media from dados_vistoria
  useEffect(() => {
    if (data?.vistoria?.dados_vistoria) {
      const dv = data.vistoria.dados_vistoria as any;
      if (dv.fotos_urls?.length) {
        const fotos = Array(10).fill('');
        dv.fotos_urls.forEach((url: string, i: number) => {
          if (i < 10) fotos[i] = url || '';
        });
        setFotosUrls(fotos);
      }
      if (dv.video_url) setVideoUrl(dv.video_url);
    }
  }, [data]);

  const handleIniciar = async () => {
    if (!id) return;
    setIniciando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const formData = new FormData();
      formData.append('acao', 'iniciar');
      formData.append('vistoria_id', id);

      const res = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/salvar-vistoria-regulador`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (!res.ok) throw new Error('Erro ao iniciar');
      toast.success('Vistoria iniciada!');
      // Refetch will update status
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIniciando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-center">
        <p className="text-destructive">Erro ao carregar vistoria</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/regulador/vistorias')}>
          Voltar
        </Button>
      </div>
    );
  }

  const { vistoria, sinistro, associado, veiculo, linkEvento } = data;
  const status = vistoria.status as string;
  const isAgendada = status === 'agendada';

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/regulador/vistorias')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Vistoria de Evento</h1>
          <p className="text-xs text-muted-foreground">
            {sinistro?.protocolo || ''}
          </p>
        </div>
        <Badge variant="secondary">
          {STATUS_LABELS[status] || status}
        </Badge>
      </div>

      {/* Dados do Evento */}
      <VistoriaEventoDados
        associado={associado}
        veiculo={veiculo}
        sinistro={sinistro}
        linkEvento={linkEvento}
      />

      {/* Se agendada, mostrar botão iniciar */}
      {isAgendada && (
        <Button
          className="w-full"
          size="lg"
          onClick={handleIniciar}
          disabled={iniciando}
        >
          {iniciando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Iniciando...
            </>
          ) : (
            'Iniciar Vistoria'
          )}
        </Button>
      )}

      {/* Se em_andamento, mostrar captura de mídias */}
      {status === 'em_andamento' && (
        <VistoriaEventoMidias
          vistoriaId={id!}
          fotosUrls={fotosUrls}
          videoUrl={videoUrl}
          onFotosChange={setFotosUrls}
          onVideoChange={setVideoUrl}
          onProsseguir={() => setOrcamentoOpen(true)}
        />
      )}

      {/* Modal de Orçamento */}
      <VistoriaEventoOrcamento
        open={orcamentoOpen}
        onClose={() => setOrcamentoOpen(false)}
        vistoriaId={id!}
        sinistroId={sinistro?.id || ''}
        valorFipe={veiculo?.valor_fipe || null}
      />
    </div>
  );
}
