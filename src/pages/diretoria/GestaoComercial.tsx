import { useState } from 'react';
import { PageHeader } from '@/components/gestao-comercial/PageHeader';
import { TabNavigation } from '@/components/gestao-comercial/TabNavigation';
import { ProdutosPlanos } from '@/components/gestao-comercial/ProdutosPlanos';
import { BeneficiosCoberturas } from '@/components/gestao-comercial/BeneficiosCoberturas';
import { BeneficiosAdicionaisConfig } from '@/components/planos/BeneficiosAdicionaisConfig';
import { SimuladorRateio } from '@/components/gestao-comercial/SimuladorRateio';
import { ElegibilidadeVeiculos } from '@/components/gestao-comercial/ElegibilidadeVeiculos';
import { RegrasVendaContent } from '@/components/gestao-comercial/RegrasVendaContent';
import { InstalacaoRotasConfig } from '@/components/gestao-comercial/InstalacaoRotasConfig';
import RateioConfig from '@/pages/configuracoes/RateioConfig';
import { MapaAtendimento } from '@/components/gestao-comercial/MapaAtendimento';

export default function GestaoComercial() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-6">
      <PageHeader />
      <TabNavigation active={activeTab} onChange={setActiveTab} />
      
      {activeTab === 0 && <ProdutosPlanos />}
      {activeTab === 1 && <BeneficiosCoberturas />}
      {activeTab === 2 && <BeneficiosAdicionaisConfig />}
      {activeTab === 3 && <SimuladorRateio />}
      {activeTab === 4 && <RateioConfig />}
      {activeTab === 5 && <ElegibilidadeVeiculos />}
      {activeTab === 6 && <RegrasVendaContent />}
      {activeTab === 7 && <InstalacaoRotasConfig />}
      {activeTab === 8 && <MapaAtendimento />}
    </div>
  );
}
