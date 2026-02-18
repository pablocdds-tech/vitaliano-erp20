import React, { useState, useMemo } from 'react';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { DRELinha, DRESecao, DREResultado } from './DRELinha';

export default function DREGerencial({ dados, totalReceita, categoriasDRE }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const {
    receitaVendas, receitaOutras,
    totalCMV, cmvCats,
    totalDespOp, despOpCats,
    totalDespAdm, despAdmCats,
    totalDespFin, despFinCats,
    totalDespOutros, despOutrosCats,
  } = dados;

  const lucroBruto = totalReceita - totalCMV;
  const totalDespOper = totalDespOp + totalDespAdm;
  const resultadoOper = lucroBruto - totalDespOper;
  const resultadoLiquido = resultadoOper - totalDespFin - totalDespOutros;
  const margemBruta = totalReceita > 0 ? (lucroBruto / totalReceita) * 100 : 0;
  const margemLiquida = totalReceita > 0 ? (resultadoLiquido / totalReceita) * 100 : 0;

  const renderCats = (cats) =>
    Object.entries(cats).length === 0
      ? <DRELinha label="Sem lançamentos" valor={0} indent totalReceita={totalReceita} />
      : Object.entries(cats).map(([nome, val]) => (
          <DRELinha key={nome} label={nome} valor={-val} indent totalReceita={totalReceita} tipo="despesa" />
        ));

  return (
    <div>
      <DRESecao titulo="Receitas" />
      <DRELinha label="Vendas (líquido)" valor={receitaVendas} indent totalReceita={totalReceita} tipo="receita" />
      {receitaOutras > 0 && <DRELinha label="Outras Receitas" valor={receitaOutras} indent totalReceita={totalReceita} tipo="receita" />}
      <DRELinha label="(=) Receita Operacional Líquida" valor={totalReceita} destaque totalReceita={totalReceita} tipo="receita" />

      <DRESecao titulo="CMV — Custo das Mercadorias Vendidas" />
      <DRELinha
        label="CMV" valor={-totalCMV} totalReceita={totalReceita}
        collapsible expanded={expanded.cmv} onToggle={() => toggle('cmv')}
      >
        {renderCats(cmvCats)}
      </DRELinha>
      <DRELinha label="(=) Lucro Bruto" valor={lucroBruto} destaque totalReceita={totalReceita} tipo={lucroBruto >= 0 ? 'receita' : 'despesa'} />
      <div className="flex justify-end">
        <span className="text-xs text-slate-400">Margem bruta: {margemBruta.toFixed(1)}%</span>
      </div>

      <DRESecao titulo="Despesas Operacionais" />
      <DRELinha
        label="Despesas Operacionais" valor={-totalDespOp} totalReceita={totalReceita}
        collapsible expanded={expanded.op} onToggle={() => toggle('op')}
      >
        {renderCats(despOpCats)}
      </DRELinha>
      <DRELinha
        label="Despesas Administrativas" valor={-totalDespAdm} totalReceita={totalReceita}
        collapsible expanded={expanded.adm} onToggle={() => toggle('adm')}
      >
        {renderCats(despAdmCats)}
      </DRELinha>
      <DRELinha label="(-) Total Despesas Operacionais" valor={-totalDespOper} destaque totalReceita={totalReceita} />
      <DRELinha label="(=) Resultado Operacional" valor={resultadoOper} destaque totalReceita={totalReceita} tipo={resultadoOper >= 0 ? 'receita' : 'despesa'} />

      <DRESecao titulo="Resultado Financeiro" />
      <DRELinha
        label="Despesas Financeiras" valor={-totalDespFin} totalReceita={totalReceita}
        collapsible expanded={expanded.fin} onToggle={() => toggle('fin')}
      >
        {renderCats(despFinCats)}
      </DRELinha>
      {totalDespOutros > 0 && (
        <DRELinha
          label="Outros" valor={-totalDespOutros} totalReceita={totalReceita}
          collapsible expanded={expanded.outros} onToggle={() => toggle('outros')}
        >
          {renderCats(despOutrosCats)}
        </DRELinha>
      )}

      <DREResultado label="(=) RESULTADO LÍQUIDO" valor={resultadoLiquido} margem={margemLiquida} />
    </div>
  );
}