import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Wrench, MapPin, Phone, Car, User, 
  Navigation, Play, CheckCircle2, Loader2, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useServico, useIniciarServicoMutation, useConcluirServicoMutation } from '@/hooks/useServicos';
import { toast } from 'sonner';

export default function ExecutarManutencao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);

  const { data: servico, isLoading } = useServico(id);
  const { mutate: iniciarServico, isPending: isIniciando } = useIniciarServicoMutation();
  const { mutate: concluirServico, isPending: isConcluindo } = useConcluirServicoMutation();

  const handleVoltar = () => {
    navigate('/instalador');
  };

  const handleNavegar = () => {
    if (servico?.latitude && servico?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${servico.latitude},${servico.longitude}`;
      window.open(url, '_blank');
    } else {
      toast.error('Endereço não disponível para navegação');
    }
  };

  const handleLigar = () => {
    if (servico?.associado?.telefone) {
      window.open(`tel:${servico.associado.telefone}`, '_self');
    }
  };

  const handleWhatsApp = () => {
    if (servico?.associado?.whatsapp || servico?.associado?.telefone) {
      const numero = (servico.associado.whatsapp || servico.associado.telefone)
        .replace(/\D/g, '');
      window.open(`https://wa.me/55${numero}`, '_blank');
    }
  };

  const handleCheguei = () => {
    if (id) {
      iniciarServico(id, {
        onSuccess: () => {
          toast.success('Chegada registrada! Agora você pode realizar a manutenção.');
        }
      });
    }
  };

  const handleConcluir = () => {
    setShowConcluirDialog(true);
  };

  const confirmarConclusao = () => {
    if (id) {
      concluirServico(id, {
        onSuccess: () => {
          toast.success('Manutenção concluída com sucesso!');
          navigate('/instalador');
        }
      });
    }
    setShowConcluirDialog(false);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!servico) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Serviço não encontrado</p>
        <Button onClick={handleVoltar} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const enderecoCompleto = [
    servico.logradouro,
    servico.numero,
    servico.bairro,
    servico.cidade,
    servico.uf
  ].filter(Boolean).join(', ') || 'Endereço não informado';

  const isEmRota = servico.status === 'em_rota';
  const isEmAndamento = servico.status === 'em_andamento';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleVoltar}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            <h1 className="text-lg font-semibold">Manutenção de Rastreador</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <Badge 
            variant="outline" 
            className={
              isEmAndamento 
                ? "bg-yellow-100 text-yellow-800 border-yellow-300" 
                : "bg-blue-100 text-blue-800 border-blue-300"
            }
          >
            {isEmAndamento ? 'Em Andamento' : 'Em Rota'}
          </Badge>
          {servico.protocolo && (
            <span className="text-sm text-muted-foreground">
              #{servico.protocolo}
            </span>
          )}
        </div>

        {/* Informações do Rastreador */}
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              Rastreador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {servico.imei_rastreador && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IMEI:</span>
                <span className="font-mono">{servico.imei_rastreador}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cliente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{servico.associado?.nome || 'Cliente'}</p>
                <p className="text-sm text-muted-foreground">{servico.associado?.telefone}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleLigar}
                  disabled={!servico.associado?.telefone}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleWhatsApp}
                  disabled={!servico.associado?.telefone && !servico.associado?.whatsapp}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Veículo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" />
              Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {servico.veiculo?.marca} {servico.veiculo?.modelo}
            </p>
            <p className="text-sm font-mono text-muted-foreground">
              {servico.veiculo?.placa}
            </p>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm">{enderecoCompleto}</p>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNavegar}
                disabled={!servico.latitude}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Motivo */}
        {servico.observacoes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Motivo da Manutenção</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{servico.observacoes}</p>
            </CardContent>
          </Card>
        )}

        {/* Ações */}
        <div className="pt-4 space-y-3">
          {isEmRota ? (
            <>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleNavegar}
                disabled={!servico.latitude}
              >
                <Navigation className="mr-2 h-4 w-4" />
                Navegar até o local
              </Button>
              <Button 
                className="w-full" 
                onClick={handleCheguei}
                disabled={isIniciando}
              >
                {isIniciando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Cheguei no Local
                  </>
                )}
              </Button>
            </>
          ) : isEmAndamento ? (
            <Button 
              className="w-full bg-green-600 hover:bg-green-700" 
              onClick={handleConcluir}
              disabled={isConcluindo}
            >
              {isConcluindo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Concluindo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Concluir Manutenção
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Dialog de Confirmação */}
      <AlertDialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir Manutenção?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme que a manutenção do rastreador foi realizada com sucesso.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarConclusao}>
              Confirmar Conclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
