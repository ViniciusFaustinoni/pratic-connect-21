import { useState } from 'react';
import { PageHeader } from '@/components/gestao-comercial/PageHeader';
import { TabNavigation } from '@/components/gestao-comercial/TabNavigation';
import { ProdutosPlanos } from '@/components/gestao-comercial/ProdutosPlanos';
import { BeneficiosCoberturas } from '@/components/gestao-comercial/BeneficiosCoberturas';
import { TabelaPrecosTab } from '@/components/gestao-comercial/TabelaPrecosTab';
import { BeneficiosAdicionaisConfig } from '@/components/planos/BeneficiosAdicionaisConfig';
import { SimuladorRateio } from '@/components/gestao-comercial/SimuladorRateio';

export default function GestaoComercial() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-6">
      <PageHeader />
      <TabNavigation active={activeTab} onChange={setActiveTab} />
      
      {activeTab === 0 && <ProdutosPlanos />}
      {activeTab === 1 && <BeneficiosCoberturas />}
      {activeTab === 2 && <TabelaPrecosTab />}
      {activeTab === 3 && <BeneficiosAdicionaisConfig />}
      {activeTab === 4 && <SimuladorRateio />}
    </div>
  );
}
