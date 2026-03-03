import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CardControleReparo } from '@/components/sinistros/CardControleReparo';
import { CardOrcamentoReparo } from '@/components/orcamento/CardOrcamentoReparo';
import { AbaTerceiroReparo } from '@/components/sinistros/AbaTerceiroReparo';
import { TermoAssinaturaCard } from './TermoAssinaturaCard';

interface SinistroDetalheReparoProps {
  sinistro: any;
  terceirosData: any[];
  isDiretor: boolean;
  isRegulador: boolean;
  isAnalista?: boolean;
  onOpenAtribuirFornecedores: () => void;
}

export function SinistroDetalheReparo({
  sinistro, terceirosData, isDiretor, isRegulador, isAnalista = false, onOpenAtribuirFornecedores,
}: SinistroDetalheReparoProps) {
  const temTerceiros = terceirosData.length > 0;

  return (
    <div className="space-y-6">
      {temTerceiros ? (
        <Tabs defaultValue="associado">
          <TabsList className="w-full">
            <TabsTrigger value="associado" className="flex-1">🚗 Associado</TabsTrigger>
            {terceirosData.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="flex-1">
                🚙 Terceiro {t.numero_sequencial}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="associado" className="space-y-6 mt-4">
            {sinistro.autentique_url && <TermoAssinaturaCard sinistro={sinistro} />}
            <CardControleReparo sinistro={sinistro} onOpenAtribuirFornecedores={onOpenAtribuirFornecedores} />
            <CardOrcamentoReparo
              sinistroId={sinistro.id}
              valorFipe={(sinistro.veiculo as any)?.valor_fipe}
              canEdit={isDiretor || isRegulador}
              canChooseType={isDiretor}
              canReset={isDiretor}
              isAnalista={isAnalista || isDiretor}
            />
          </TabsContent>
          {terceirosData.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4">
              <AbaTerceiroReparo terceiro={t} sinistroId={sinistro.id} associadoId={sinistro.associado_id} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <>
          {sinistro.autentique_url && <TermoAssinaturaCard sinistro={sinistro} />}
          <CardControleReparo sinistro={sinistro} onOpenAtribuirFornecedores={onOpenAtribuirFornecedores} />
          <CardOrcamentoReparo
            sinistroId={sinistro.id}
            valorFipe={(sinistro.veiculo as any)?.valor_fipe}
            canEdit={isDiretor || isRegulador}
            canChooseType={isDiretor}
            canReset={isDiretor}
            isAnalista={isAnalista || isDiretor}
          />
        </>
      )}
    </div>
  );
}
