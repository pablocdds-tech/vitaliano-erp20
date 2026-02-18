import React, { useState } from 'react';
import { DRELinha, DRESecao, DREResultado } from './DRELinha';

export default function DREFinanceiro({ dados, totalReceita }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const {
    receitaVendas, receitaOutras,
    totalImpostos, impostosCats,
    totalCMV, cmvCats,
    totalDespOp, despOpCats,
    totalDespAdm, despAdmCats,
    totalDespFin, despFinCats,
    totalRecNaoOp, recNaoOpCats,
    totalDespOutros, despOutrosCats,
  } = dados;

  const receitaBruta = receitaVendas + receitaOutras;
  const receitaLiquida = receitaBruta - totalImpostos;
  const lucroBruto = receitaLiquida - totalCMV;
  const lucroOperacional = lucroBruto - totalDespOp - totalDespAdm;
  const lucroAntesIR = lucroOperacional - totalDespFin + totalRecNaoOp;
  const lucroLiquido = lucroAntesIR - totalDespOutros;
  const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

  const renderCats = (cats) =>
    Object.entries(cats).length === 0
      ? <DRELinha label="Sem lançamentos" valor={0} indent totalReceita={totalReceita} />
      : Object.entries(cats).map(([nome, val]) => (
          <DRELinha key={nome} label={nome} valor={-val} indent totalReceita={totalReceita} tipo="despesa" />
        ));

  return (
    <div>
      <DRESecao titulo="Receita Operacional Bruta" />
      <DRELinha label="Receita de Vendas" valor={receitaVendas} indent totalReceita={totalReceita} tipo="receita" />
      {receitaOutras > 0 && <DRELinha label="Outras Receitas Operacionais" valor={receitaOutras} indent totalReceita={totalReceita} tipo="receita" />}
      <DRELinha label="(=) Receita Operacional Bruta" valor={receitaBruta} destaque totalReceita={totalReceita} tipo="receita" />

      <DRESecao titulo="Deduções da Receita" />
      <DRELinha
        label="Impostos sobre Receita" valor={-totalImpostos} totalReceita={totalReceita}
        collapsible expanded={expanded.imp} onToggle={() => toggle('imp')}
      >
        {renderCats(impostosCats)}
      </DRELinha>
      <DRELinha label="(=) Receita Operacional Líquida" valor={receitaLiquida} destaque totalReceita={totalReceita} tipo={receitaLiquida >= 0 ? 'receita' : 'despesa'} />

      <DRESecao titulo="Custo com Vendas" />
      <DRELinha
        label="Custo das Mercadorias Vendidas (CMV)" valor={-totalCMV} totalReceita={totalReceita}
        collapsible expanded={expanded.cmv} onToggle={() => toggle('cmv')}
      >
        {renderCats(cmvCats)}
      </DRELinha>
      <DRELinha label="(=) Lucro Bruto" valor={lucroBruto} destaque totalReceita={totalReceita} tipo={lucroBruto >= 0 ? 'receita' : 'despesa'} />

      <DRESecao titulo="Despesas Operacionais" />
      <DRELinha
        label="Despesas Administrativas" valor={-totalDespAdm} totalReceita={totalReceita}
        collapsible expanded={expanded.adm} onToggle={() => toggle('adm')}
      >
        {renderCats(despAdmCats)}
      </DRELinha>
      <DRELinha
        label="Despesas Operacionais" valor={-totalDespOp} totalReceita={totalReceita}
        collapsible expanded={expanded.op} onToggle={() => toggle('op')}
      >
        {renderCats(despOpCats)}
      </DRELinha>
      <DRELinha label="(=) Lucro Operacional" valor={lucroOperacional} destaque totalReceita={totalReceita} tipo={lucroOperacional >= 0 ? 'receita' : 'despesa'} />

      <DRESecao titulo="Resultado Não Operacional" />
      <DRELinha
        label="Despesas Financeiras" valor={-totalDespFin} totalReceita={totalReceita}
        collapsible expanded={expanded.fin} onToggle={() => toggle('fin')}
      >
        {renderCats(despFinCats)}
      </DRELinha>
      {Object.keys(recNaoOpCats).length > 0 && (
        <DRELinha
          label="Receitas Não Operacionais" valor={totalRecNaoOp} totalReceita={totalReceita}
          collapsible expanded={expanded.nop} onToggle={() => toggle('nop')}
        >
          {Object.entries(recNaoOpCats).map(([nome, val]) => (
            <DRELinha key={nome} label={nome} valor={val} indent totalReceita={totalReceita} tipo="receita" />
          ))}
        </DRELinha>
      )}
      {totalDespOutros > 0 && (
        <DRELinha
          label="Outros encargos (IR, Pró-labore, etc.)" valor={-totalDespOutros} totalReceita={totalReceita}
          collapsible expanded={expanded.outros} onToggle={() => toggle('outros')}
        >
          {renderCats(despOutrosCats)}
        </DRELinha>
      )}

      <DREResultado label="(=) LUCRO LÍQUIDO DO EXERCÍCIO" valor={lucroLiquido} margem={margemLiquida} />
    </div>
  );
}