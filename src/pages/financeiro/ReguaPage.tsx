import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ListChecks, Send } from 'lucide-react';
import ReguaCobranca from '@/pages/cobranca/ReguaCobranca';
import EmissaoCobrancas from '@/pages/financeiro/EmissaoCobrancas';

/**
 * Página unificada da Régua de Cobrança.
 * Sub-abas:
 *  - Régua    → fluxo automatizado de cobrança (ReguaCobranca)
 *  - Emissão  → emissão manual/lote de cobranças (EmissaoCobrancas)
 */
export default function ReguaPage() {
  const [tab, setTab] = useState<'regua' | 'emissao'>('regua');

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="regua" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Régua
          </TabsTrigger>
          <TabsTrigger value="emissao" className="gap-2">
            <Send className="h-4 w-4" />
            Emissão de Cobranças
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regua" className="mt-4">
          <ReguaCobranca />
        </TabsContent>
        <TabsContent value="emissao" className="mt-4">
          <EmissaoCobrancas />
        </TabsContent>
      </Tabs>
    </div>
  );
}
