import { PainelAprovacoesElegibilidade } from '@/components/aprovacoes/PainelAprovacoesElegibilidade';

export default function AprovacoesElegibilidade() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Aprovações de Elegibilidade</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie solicitações de autorização para veículos bloqueados por regras de elegibilidade
        </p>
      </div>

      <PainelAprovacoesElegibilidade />
    </div>
  );
}
