import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Search, ArrowLeft, User, FileSignature, CheckCircle } from 'lucide-react';
import { useBuscarAssociados, useAtribuirPlanoSemTermo, useAtribuirPlanoComTermo, type AssociadoBusca } from '@/hooks/useAtribuirPlano';

interface Props {
  open: boolean;
  onClose: () => void;
  planoId: string;
  planoNome: string;
}

export function AtribuirPlanoModal({ open, onClose, planoId, planoNome }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [termo, setTermo] = useState('');
  const [selected, setSelected] = useState<AssociadoBusca | null>(null);
  const [envioTermo, setEnvioTermo] = useState<'sem' | 'com'>('sem');

  const { data: resultados = [], isLoading: buscando } = useBuscarAssociados(termo);
  const atribuirSem = useAtribuirPlanoSemTermo();
  const atribuirCom = useAtribuirPlanoComTermo();

  const isPending = atribuirSem.isPending || atribuirCom.isPending;

  const handleSelect = (assoc: AssociadoBusca) => {
    setSelected(assoc);
    setStep(2);
  };

  const handleConfirm = () => {
    if (!selected) return;
    const params = { planoId, associadoId: selected.id, planoNome };
    if (envioTermo === 'sem') {
      atribuirSem.mutate(params, { onSuccess: handleClose });
    } else {
      atribuirCom.mutate(params, { onSuccess: handleClose });
    }
  };

  const handleClose = () => {
    setStep(1);
    setTermo('');
    setSelected(null);
    setEnvioTermo('sem');
    onClose();
  };

  const formatCpf = (cpf: string) => {
    if (!cpf) return '';
    const c = cpf.replace(/\D/g, '');
    if (c.length !== 11) return cpf;
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Atribuir plano: {planoNome}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou telefone..."
                value={termo}
                onChange={e => setTermo(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {buscando && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!buscando && termo.length >= 2 && resultados.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum associado encontrado
                </p>
              )}

              {resultados.map(assoc => (
                <button
                  key={assoc.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  onClick={() => handleSelect(assoc)}
                >
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{assoc.nome}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{formatCpf(assoc.cpf)}</span>
                      <span className="capitalize">• {assoc.status}</span>
                    </div>
                  </div>
                  {assoc.plano_nome && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded shrink-0">
                      {assoc.plano_nome}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {termo.length < 2 && (
              <p className="text-xs text-muted-foreground text-center">
                Digite ao menos 2 caracteres para buscar
              </p>
            )}
          </div>
        )}

        {step === 2 && selected && (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selected.nome}</span>
              </div>
              <p className="text-xs text-muted-foreground">CPF: {formatCpf(selected.cpf)}</p>
              {selected.plano_nome && (
                <p className="text-xs text-amber-600">
                  ⚠ Plano atual: {selected.plano_nome} — será substituído
                </p>
              )}
            </div>

            {/* Opções de envio */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Envio do termo de filiação</Label>
              <RadioGroup value={envioTermo} onValueChange={(v) => setEnvioTermo(v as 'sem' | 'com')}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="sem" id="sem" className="mt-0.5" />
                  <div>
                    <Label htmlFor="sem" className="text-sm font-medium cursor-pointer">
                      Sem envio do termo
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Atribui o plano imediatamente e cria o contrato como ativo
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="com" id="com" className="mt-0.5" />
                  <div>
                    <Label htmlFor="com" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                      <FileSignature className="h-3.5 w-3.5" />
                      Com envio do termo (Autentique)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Envia o termo de filiação para o e-mail do associado. O plano só será atribuído após a assinatura.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                {envioTermo === 'sem' ? 'Atribuir agora' : 'Enviar termo'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
