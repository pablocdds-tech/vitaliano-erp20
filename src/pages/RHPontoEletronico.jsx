import React from 'react';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Clock } from 'lucide-react';
import PontoQuiosqueAoVivo from '@/components/ponto/PontoQuiosqueAoVivo';
import CadastroFacial from '@/components/ponto/CadastroFacial';
import PontoRegistros from '@/components/ponto/PontoRegistros';
import PontoRelatorio from '@/components/ponto/PontoRelatorio';
import PontoAjustes from '@/components/ponto/PontoAjustes';

export default function RHPontoEletronico() {
  return (
    <div>
      <PageHeader
        title="Ponto Eletrônico"
        subtitle="Controle de jornada com reconhecimento facial"
        icon={Clock}
        breadcrumbs={[{ label: 'RH', href: '/RHFuncionarios' }, { label: 'Ponto Eletrônico' }]}
      />

      <Tabs defaultValue="ao-vivo">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="ao-vivo">Quiosque ao Vivo</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro Facial</TabsTrigger>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="ao-vivo"><PontoQuiosqueAoVivo /></TabsContent>
        <TabsContent value="cadastro"><CadastroFacial /></TabsContent>
        <TabsContent value="registros"><PontoRegistros /></TabsContent>
        <TabsContent value="relatorio"><PontoRelatorio /></TabsContent>
        <TabsContent value="ajustes"><PontoAjustes /></TabsContent>
      </Tabs>
    </div>
  );
}