import { useState } from 'react';
import { usePlanos } from '@/hooks/usePlanos';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AtribuirPlanoModal } from './AtribuirPlanoModal';

export function AtribuicaoPlanoTab() {
  const { data: planos = [], isLoading } = usePlanos();
  const [filtro, setFiltro] = useState('');
  const [selectedPlano, setSelectedPlano] = useState<{ id: string; nome: string } | null>(null);

  const filtered = planos.filter(p => {
    if (!filtro) return true;
    const term = filtro.toLowerCase();
    return p.nome.toLowerCase().includes(term);
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar planos..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum plano encontrado
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map(plano => (
              <div
                key={plano.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{plano.nome}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {plano.valor_mensal != null && (
                      <span>Mensal: R$ {plano.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    )}
                    {plano.valor_adesao != null && (
                      <span>Adesão: R$ {plano.valor_adesao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setSelectedPlano({ id: plano.id, nome: plano.nome })}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Atribuir
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPlano && (
        <AtribuirPlanoModal
          open={!!selectedPlano}
          onClose={() => setSelectedPlano(null)}
          planoId={selectedPlano.id}
          planoNome={selectedPlano.nome}
        />
      )}
    </>
  );
}
