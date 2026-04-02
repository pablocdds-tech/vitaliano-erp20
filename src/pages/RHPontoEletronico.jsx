import React from 'react';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Clock } from 'lucide-react';
import { pontoSectionText, pontoTabList, pontoTabTrigger } from '@/components/ponto/pontoStyles';
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

      <Tabs defaultValue="ao-vivo" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className={pontoSectionText}>
            Painel administrativo do ponto com visual unificado para operação em desktop e uso confortável no celular.
          </p>
          <TabsList className={pontoTabList}>
            <TabsTrigger className={pontoTabTrigger} value="ao-vivo">Quiosque</TabsTrigger>
            <TabsTrigger className={pontoTabTrigger} value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger className={pontoTabTrigger} value="registros">Registros</TabsTrigger>
            <TabsTrigger className={pontoTabTrigger} value="relatorio">Relatório</TabsTrigger>
            <TabsTrigger className={pontoTabTrigger} value="ajustes">Ajustes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent className="mt-0" value="ao-vivo"><PontoQuiosqueAoVivo /></TabsContent>
        <TabsContent className="mt-0" value="cadastro"><CadastroFacial /></TabsContent>
        <TabsContent className="mt-0" value="registros"><PontoRegistros /></TabsContent>
        <TabsContent className="mt-0" value="relatorio"><PontoRelatorio /></TabsContent>
        <TabsContent className="mt-0" value="ajustes"><PontoAjustes /></TabsContent>
      </Tabs>
    </div>
  );
}