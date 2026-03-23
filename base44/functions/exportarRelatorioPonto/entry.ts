import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { funcionario_nome, mes_ano, dias, totais } = await req.json();

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();

    // Título
    doc.setFontSize(16);
    doc.text('Relatório de Ponto Eletrônico', 14, 18);

    doc.setFontSize(10);
    doc.text(`Funcionário: ${funcionario_nome}`, 14, 26);
    doc.text(`Período: ${mes_ano}`, 14, 32);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 38);

    // Resumo
    doc.setFontSize(11);
    doc.text(`Total Horas: ${totais.totalHoras}   |   Adicional Noturno (22h-05h): ${totais.totalNoturno}   |   Dias Trabalhados: ${totais.diasTrabalhados}`, 14, 48);

    // Tabela
    const cols = ['Data', 'Dia', 'Entrada', 'Saída Alm.', 'Volta Alm.', 'Saída', 'Total', 'Noturno'];
    const colW = [25, 18, 28, 28, 28, 28, 22, 22];
    const startX = 14;
    let y = 56;

    // Header
    doc.setFillColor(240, 240, 240);
    doc.rect(startX, y - 4, colW.reduce((a, b) => a + b, 0), 8, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    let x = startX;
    cols.forEach((col, i) => {
      doc.text(col, x + 2, y);
      x += colW[i];
    });

    doc.setFont(undefined, 'normal');
    y += 8;

    for (const d of dias) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 18;
        // Reprint header
        doc.setFillColor(240, 240, 240);
        doc.rect(startX, y - 4, colW.reduce((a, b) => a + b, 0), 8, 'F');
        doc.setFont(undefined, 'bold');
        x = startX;
        cols.forEach((col, i) => { doc.text(col, x + 2, y); x += colW[i]; });
        doc.setFont(undefined, 'normal');
        y += 8;
      }

      // Data formatada dd/MM
      const dataFormatada = d.data ? `${d.data.substring(8, 10)}/${d.data.substring(5, 7)}` : '';
      const row = [
        dataFormatada,
        d.diaSemana || '',
        d.entrada || '-',
        d.saidaAlmoco || '-',
        d.voltaAlmoco || '-',
        d.saida || '-',
        d.temRegistro ? (d.totalFormatado || '-') : '-',
        d.noturnos > 0 ? (d.noturnoFormatado || '-') : '-'
      ];

      // Highlight noturno
      if (d.noturnos > 0) {
        doc.setTextColor(128, 0, 128);
      }

      x = startX;
      row.forEach((cell, i) => {
        doc.text(String(cell), x + 2, y);
        x += colW[i];
      });

      doc.setTextColor(0, 0, 0);

      // Linha separadora
      doc.setDrawColor(230, 230, 230);
      doc.line(startX, y + 2, startX + colW.reduce((a, b) => a + b, 0), y + 2);

      y += 7;
    }

    // Rodapé com totais
    y += 5;
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL HORAS: ${totais.totalHoras}`, startX, y);
    doc.setTextColor(128, 0, 128);
    doc.text(`ADICIONAL NOTURNO: ${totais.totalNoturno}`, startX + 80, y);
    doc.setTextColor(0, 0, 0);
    doc.text(`DIAS TRABALHADOS: ${totais.diasTrabalhados}`, startX + 180, y);

    y += 10;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.text('* Adicional noturno: período das 22:00 às 05:00 (Art. 73, CLT)', startX, y);

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=relatorio_ponto_${mes_ano}.pdf`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});