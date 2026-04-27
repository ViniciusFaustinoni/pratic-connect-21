import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useVistoriadoresPrestadores } from '@/hooks/useVistoriadoresPrestadores';
import { useAtribuirServicoPrestador, AtribuirPrestadorResult } from '@/hooks/useAtribuicaoManual';
import { LinkPrestadorResultDialog } from '@/components/monitoramento/LinkPrestadorResultDialog';

interface AtribuirPrestadorPopoverProps {
  servicoId: string;
}

export function AtribuirPrestadorPopover({ servicoId }: AtribuirPrestadorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedPrestador, setSelectedPrestador] = useState<{ id: string; nome: string; telefone?: string | null } | null>(null);
  const [valor, setValor] = useState('');
  const [linkResult, setLinkResult] = useState<AtribuirPrestadorResult | null>(null);

  const { data: prestadores, isLoading } = useVistoriadoresPrestadores();
  const mutation = useAtribuirServicoPrestador();

  const ativos = (prestadores || []).filter((p: any) => p.ativo);

  const handleSelectPrestador = (p: any) => {
    setSelectedPrestador({ id: p.id, nome: p.nome, telefone: p.telefone });
  };

  const handleConfirm = async () => {
    if (!selectedPrestador) return;
    // Valor é opcional — quando vazio, envia 0 (será definido depois pela operação)
    const valorNum = valor.trim() === '' ? 0 : parseFloat(valor);
    if (isNaN(valorNum) || valorNum < 0) {
      toast.error('Valor inválido');
      return;
    }

    try {
      const result = await mutation.mutateAsync({
        servicoId,
        prestadorId: selectedPrestador.id,
        prestadorNome: selectedPrestador.nome,
        prestadorTelefone: selectedPrestador.telefone,
        valor: valorNum,
      });
      setOpen(false);
      setSelectedPrestador(null);
      setValor('');
      setLinkResult(result);
    } catch {
      // handled by mutation
    }
  };

  const handleBack = () => {
    setSelectedPrestador(null);
    setValor('');
  };

  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSelectedPrestador(null); setValor(''); } }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={(e) => e.stopPropagation()}
            aria-label="Atribuir a prestador"
            title="Atribuir a prestador externo"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-0"
          align="end"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!selectedPrestador ? (
            <>
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Atribuir a Prestador
                </p>
              </div>
              <Command>
                <CommandInput placeholder="Buscar prestador..." />
                <CommandList>
                  {isLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>Nenhum prestador ativo.</CommandEmpty>
                      <CommandGroup>
                        {ativos.map((p: any) => (
                          <CommandItem
                            key={p.id}
                            value={p.nome}
                            onSelect={() => handleSelectPrestador(p)}
                            className="flex items-center gap-2"
                          >
                            <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {(p.nome || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="flex-1 truncate text-sm">{p.nome}</span>
                            <Badge variant="outline" className="text-[10px] h-4 bg-amber-50 text-amber-700 border-amber-200">
                              Prestador
                            </Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </>
          ) : (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{selectedPrestador.nome}</p>
                <Button variant="ghost" size="sm" onClick={handleBack} className="text-xs h-7">Voltar</Button>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Valor (R$) <span className="text-muted-foreground font-normal">(opcional)</span></label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 80.00 (opcional)"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                onClick={handleConfirm}
                disabled={mutation.isPending}
                className="w-full h-8 text-sm"
                size="sm"
              >
                {mutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Gerar Link
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <LinkPrestadorResultDialog
        open={!!linkResult}
        onClose={() => setLinkResult(null)}
        url={linkResult?.url || ''}
        prestadorNome={linkResult?.prestadorNome || ''}
        prestadorTelefone={linkResult?.prestadorTelefone}
      />
    </>
  );
}
