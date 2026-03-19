import { useState, useEffect } from 'react';
import { ArrowLeftRight, PlusCircle, Car, AlertTriangle, Ban } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVerificarDebitosAssociado } from '@/hooks/useVerificarDebitosAssociado';
import { useInclusaoBloqueioDebito } from '@/hooks/useInclusaoBloqueioDebito';
import { formatarMoeda } from '@/utils/format';

interface VeiculoAtivoInfo {
  associado_id: string;
  associado_nome: string;
  veiculo_placa: string;
  veiculo_modelo: string;
  veiculo_marca: string;
}

interface DialogTipoOperacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculoAtivo: VeiculoAtivoInfo;
  onSubstituicao: (associadoId: string) => void;
  onInclusao: () => void;
}

export function DialogTipoOperacao({
  open,
  onOpenChange,
  veiculoAtivo,
  onSubstituicao,
  onInclusao,
}: DialogTipoOperacaoProps) {
  const [mostrarVerificacao, setMostrarVerificacao] = useState(false);

  const { data: debitos, isLoading: isLoadingDebitos } = useVerificarDebitosAssociado(
    mostrarVerificacao ? veiculoAtivo.associado_id : undefined
  );
  const { data: bloqueioAtivo = true } = useInclusaoBloqueioDebito();

  const handleInclusaoClick = () => {
    setMostrarVerificacao(true);
  };

  // Quando os débitos são carregados e não há débito, prosseguir
  const debitosCarregados = mostrarVerificacao && debitos !== undefined && !isLoadingDebitos;
  const temDebito = debitos?.temDebito ?? false;

  // Auto-prosseguir quando verificação concluída sem débitos
  if (debitosCarregados && !temDebito && mostrarVerificacao) {
    // Usar setTimeout para evitar update durante render
    setTimeout(() => {
      setMostrarVerificacao(false);
      onInclusao();
      onOpenChange(false);
    }, 0);
  }

  const handleProsseguirComAviso = () => {
    setMostrarVerificacao(false);
    onInclusao();
    onOpenChange(false);
  };

  const handleVoltar = () => {
    setMostrarVerificacao(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => {
      if (!v) setMostrarVerificacao(false);
      onOpenChange(v);
    }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Cliente já possui veículo ativo
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <strong>{veiculoAtivo.associado_nome}</strong> já possui um veículo ativo na Praticcar:
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                <Car className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {veiculoAtivo.veiculo_marca} {veiculoAtivo.veiculo_modelo}
                  </p>
                  <p className="text-muted-foreground">
                    Placa: <Badge variant="outline" className="text-xs uppercase">{veiculoAtivo.veiculo_placa}</Badge>
                  </p>
                </div>
              </div>

              {/* Verificação de débitos */}
              {mostrarVerificacao && isLoadingDebitos && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                  <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
                    Verificando débitos pendentes do associado...
                  </AlertDescription>
                </Alert>
              )}

              {debitosCarregados && temDebito && bloqueioAtivo && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                  <Ban className="h-4 w-4" />
                  <AlertDescription className="text-sm space-y-2">
                    <p className="font-medium">Inclusão bloqueada — débitos pendentes</p>
                    <p>É necessário quitar todos os débitos antes de incluir um novo veículo:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {debitos.debitosPorVeiculo.map((d, i) => (
                        <li key={i}>
                          <strong>{d.marca} {d.modelo}</strong> (Placa: {d.placa}) — {d.quantidade} cobrança(s) em aberto, total: <strong>{formatarMoeda(d.total)}</strong>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {debitosCarregados && temDebito && !bloqueioAtivo && (
                <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-300 space-y-2">
                    <p className="font-medium">Atenção — débitos pendentes encontrados</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {debitos.debitosPorVeiculo.map((d, i) => (
                        <li key={i}>
                          <strong>{d.marca} {d.modelo}</strong> (Placa: {d.placa}) — {formatarMoeda(d.total)}
                        </li>
                      ))}
                    </ul>
                    <p>Você pode prosseguir, mas recomenda-se a quitação antes da inclusão.</p>
                  </AlertDescription>
                </Alert>
              )}

              {!mostrarVerificacao && (
                <p className="text-sm">Este cliente deseja substituir o veículo atual ou incluir um segundo veículo?</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          {!mostrarVerificacao ? (
            <>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                variant="outline"
                onClick={handleInclusaoClick}
                className="gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Incluir segundo veículo
              </Button>
              <Button
                onClick={() => {
                  onSubstituicao(veiculoAtivo.associado_id);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Substituir veículo
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleVoltar}>
                Voltar
              </Button>
              {debitosCarregados && temDebito && !bloqueioAtivo && (
                <Button onClick={handleProsseguirComAviso} className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Prosseguir com inclusão
                </Button>
              )}
              {debitosCarregados && temDebito && bloqueioAtivo && (
                <Button disabled className="gap-2">
                  <Ban className="h-4 w-4" />
                  Inclusão bloqueada
                </Button>
              )}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
