// Gera o relatorio do TP2 em .docx a partir de dados/resumo.json e figuras/*.png
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, AlignmentType,
  WidthType, BorderStyle, ShadingType, PageNumber, SectionType, HeadingLevel, LevelFormat, VerticalAlign,
} = require("docx");

const RAIZ = path.join(__dirname, "..");
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, "dados/resumo.json"), "utf8"));
const FONT = "Times New Roman";
const URLBASE = "https://github.com/poipoipepe/tp2-so/tree/main";

// ---------- helpers ----------
function runs(text, base = {}) {
  // **negrito**, *italico*, `codigo`
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Courier New", ...base, size: (base.size || 24) - 2 }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: FONT, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}
const P = (text, o = {}) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, before: 0, after: 0 },
  indent: o.noIndent ? undefined : { firstLine: 709 }, children: runs(text), ...o.extra,
});
const H1 = (t, pb = false) => new Paragraph({
  heading: HeadingLevel.HEADING_1, pageBreakBefore: pb, children: [new TextRun({ text: t })],
});
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })] });
const legenda = (t) => new Paragraph({
  alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 60, line: 240 },
  children: runs(t, { size: 20 }),
});
const fonte = (t = "Fonte: Elaborada pelos autores (2026).") => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 40, after: 160, line: 240 }, children: runs(t, { size: 20 }),
});
const img = (file, wCm) => {
  const buf = fs.readFileSync(path.join(RAIZ, "figuras", file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const wpx = Math.round((wCm / 2.54) * 96);
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: true,
    children: [new ImageRun({ type: "png", data: buf, transformation: { width: wpx, height: Math.round(wpx * h / w) },
      altText: { title: file, description: file, name: file } })],
  });
};
const TW = 9071; // largura util (A4, margens 3 e 2 cm)
function tabela(cab, linhas, larguras) {
  const soma = larguras.reduce((a, b) => a + b, 0);
  const w = larguras.map((x) => Math.round((x / soma) * TW));
  w[w.length - 1] += TW - w.reduce((a, b) => a + b, 0);
  const lin = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  const nada = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cel = (t, i, head, last) => new TableCell({
    width: { size: w[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
    margins: { top: 20, bottom: 20, left: 60, right: 60 },
    borders: { top: head ? lin : nada, bottom: head || last ? lin : nada, left: nada, right: nada },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { line: 240 },
      children: runs(String(t), { size: 19, bold: head })})],
  });
  return new Table({
    width: { size: TW, type: WidthType.DXA }, columnWidths: w, alignment: AlignmentType.CENTER,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: cab.map((c, i) => cel(c, i, true, false)) }),
      ...linhas.map((l, k) => new TableRow({ cantSplit: true, children: l.map((c, i) => cel(c, i, false, k === linhas.length - 1)) }))],
  });
}
const bullets = (items) => items.map((t) => new Paragraph({
  numbering: { reference: "pts", level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360 }, children: runs(t),
}));
const cen = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240, after: o.after || 0 },
  children: [new TextRun({ text: t, font: FONT, size: o.size || 24, bold: !!o.bold })] });
const sp = (n = 1) => Array.from({ length: n }, () => cen(""));

// ---------- capa ----------
const capa = [
  cen("CENTRO FEDERAL DE EDUCAÇÃO TECNOLÓGICA DE MINAS GERAIS", { bold: true }),
  cen("Disciplina: Sistemas Operacionais"),
  ...sp(6),
  cen("LIGIA CRISTINA AGUIAR BENEDITO"),
  cen("PEDRO FORTUNATO OLIVEIRA"),
  ...sp(8),
  cen("TRABALHO PRÁTICO 2: SINCRONIZAÇÃO DE THREADS COM SEMÁFOROS POSIX", { bold: true, after: 0 }),
  cen("Montanha-russa, travessia dos babuínos e construção de H2O", { bold: true }),
  ...sp(4),
  new Paragraph({ indent: { left: 4536 }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 240 }, children: [new TextRun({
    text: "Relatório apresentado à disciplina de Sistemas Operacionais do Centro Federal de Educação Tecnológica de Minas Gerais, como requisito parcial para avaliação. Professora: Michelle Hanne.",
    font: FONT, size: 20 })] }),
  ...sp(9),
  cen("Belo Horizonte"), cen("2026"),
];

// ---------- corpo ----------
const c1 = R.t_c1, c2 = R.t_c2;
const tab1 = tabela(
  ["m", "T (s)", "CV (%)", "λ (pass./s)", "S = T(1)/T(m)", "S' = λ(m)/λ(1)", "E = S'/m", "Espera c.1 (ms)", "Espera c.2 (ms)"],
  c1.map((l, i) => [l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], c2[i][7]]),
  [5, 8, 7, 10, 11, 12, 8, 11, 11]);
const tab2 = tabela(["m", "T (ms)", "CV (%)", "Tempo por volta (µs)", "CPU por volta (µs)", "Trocas de contexto por volta"],
  R.t_c3, [5, 8, 8, 14, 13, 16]);
const tab3 = tabela(["N", "T (s)", "Vazão (bab./s)", "Espera média (ms)", "Espera p95 (ms)", "Espera máx. (ms)", "Trocas de sentido"],
  R.t_q2a, [5, 10, 12, 13, 13, 13, 10]);
const tab4 = tabela(["Sentido 0/1 (%)", "Variante", "Vazão (bab./s)", "Espera média (ms)", "Espera máx. (ms)", "Trocas de sentido"],
  R.t_q2b, [11, 9, 13, 14, 14, 10]);
const tab5 = tabela(["Entrada", "Saída (ordem dos bond)", "Resultado"], [
  ["HOH", "HOH", "válida (1 molécula)"],
  ["OOHHHH", "HHOHOH", "válida (2 moléculas)"],
  ["HHHOOH", "OHHHOH", "válida (2 moléculas)"],
  ["OHHHH", "HHO", "válida; 2 threads H seguem bloqueadas"],
], [10, 14, 20]);
const tab6 = tabela(["Variante", "Moléculas por execução", "Threads", "Execuções", "Execuções inválidas"],
  R.t_q3, [14, 12, 8, 10, 12]);
const quadro1 = tabela(["Semáforo / variável", "Função"], [
  ["`load_turn[i]`, `unload_turn[i]`", "Anel de carros: só o carro da vez embarca (e desembarca); o carro 0 começa com 1."],
  ["`load_q`", "Passageiros esperam o `load`; o carro libera C permissões."],
  ["`all_aboard`", "O C-ésimo passageiro a embarcar avisa o carro de que está cheio."],
  ["`unload_q[i]`", "Fila de desembarque exclusiva do carro i; só seus passageiros esperam nela."],
  ["`all_ashore[i]`", "O C-ésimo passageiro a desembarcar avisa o carro i."],
  ["`loading_car`", "Índice do carro que está embarcando, lido pelos passageiros ao acordar."],
], [11, 25]);

const q1v = R.q1_viol, q1r = R.q1_runs;
const body = [
  H1("1 INTRODUÇÃO"),
  P("Este relatório apresenta as decisões de projeto e a avaliação experimental de três problemas clássicos de sincronização, implementados em C com POSIX Threads e semáforos POSIX: a montanha-russa com vários carros (Questão 1), a travessia dos babuínos (Questão 2) e a construção de moléculas de H2O (Questão 3). Cada solução foi acompanhada de um oráculo de verificação independente, que checa as restrições do enunciado durante a execução. Os códigos-fonte, os scripts e os dados brutos estão disponíveis em:"),
  P(`Questão 1: ${URLBASE}/questao-1`, { noIndent: true }),
  P(`Questão 2: ${URLBASE}/questao-2`, { noIndent: true }),
  P(`Questão 3: ${URLBASE}/questao-3`, { noIndent: true }),

  H1("2 METODOLOGIA GERAL"),
  P("Os testes usaram uma máquina virtual Linux (kernel 6.18) com uma CPU virtual Intel Xeon de 2,1 GHz e 3,9 GB de memória, compilação com `gcc -O2 -pthread` (gcc 13.3). Como há uma única CPU, não existe paralelismo real entre as threads. Isso é uma limitação, mas os três problemas são dominados por bloqueio e serialização, e as durações de load, run, unload e travessia são simuladas com `usleep`; o experimento isola, portanto, o custo da sincronização. Os tempos foram medidos com `CLOCK_MONOTONIC`, a partir da liberação simultânea das threads por uma barreira. O uso de CPU e o número de trocas de contexto vieram de `getrusage`, pois `perf` não estava disponível. Cada configuração da Questão 1 foi repetida 30 vezes e as da Questão 2, 10 vezes, com as configurações intercaladas a cada rodada para distribuir a deriva da máquina. Calcularam-se a média, o desvio-padrão (DP) e o coeficiente de variação (CV = DP/média), aceitável até 5%."),
  P("Um detalhe afeta a interpretação dos resultados: medições mostraram que `usleep(1000)` dura em média 1,13 ms e `usleep(10000)` dura 10,17 ms, ou seja, os tempos simulados são ligeiramente maiores que os nominais."),

  H1("3 QUESTÃO 1 – MONTANHA-RUSSA COM VÁRIOS CARROS"),
  H2("3.1 Decisões de projeto"),
  P("Há n threads de passageiros e m threads de carro, cada carro com um identificador i entre 0 e m − 1 e R voltas. O Quadro 1 resume os semáforos. O carro executa, a cada volta: esperar a sua vez de embarcar, `load`, liberar o próximo carro, `run`, esperar a sua vez de desembarcar, `unload`, liberar o próximo."),
  legenda("**Quadro 1** – Semáforos e variáveis compartilhadas da montanha-russa"), quadro1, fonte(),
  P("A restrição de apenas um carro embarcando por vez e a de desembarque na ordem de embarque são resolvidas por um mesmo mecanismo: os carros formam um anel. O carro i só embarca após receber `load_turn[i]`, que é liberado pelo carro i − 1 ao terminar de embarcar, e o mesmo vale para `unload_turn`. Assim, tanto o embarque quanto o desembarque seguem a ordem 0, 1, …, m − 1, 0, …, e um carro nunca ultrapassa outro. A partida (`run`) ocorre fora das seções de anel, então vários carros ficam na pista ao mesmo tempo."),
  P("Os passageiros não sabem em que carro vão embarcar. Por isso o carro grava seu índice em `loading_car` antes de liberar C permissões em `load_q`, e cada passageiro lê essa variável ao acordar, antes de se contar em `boarders`. Como só um carro embarca por vez, e o carro só prossegue depois que o C-ésimo passageiro libera `all_aboard`, o valor é estável durante a leitura. Já o desembarque usa uma fila por carro (`unload_q[i]`). Com uma fila única, as C permissões do `unload` do carro i poderiam acordar passageiros de outro carro ainda na pista, violando a restrição de que todos de uma carga desembarquem antes das cargas seguintes. É a mesma lição do TP1: um semáforo compartilhado não distingue o destinatário de cada sinal."),
  P("As restrições do enunciado ficam assim garantidas: passageiros só embarcam após o `load` (esperam em `load_q`); o carro só parte após `all_aboard`; e passageiros só desembarcam após o `unload` (esperam em `unload_q[i]`). Não há deadlock porque os semáforos de anel são adquiridos sempre na mesma ordem global e cada carro só espera por eventos que o carro anterior ou os passageiros certamente produzem. Ao fim das voltas, uma *flag* `done` e n sinais em `load_q` liberam os passageiros que ainda esperam, para que o programa termine."),
  P("O oráculo usa apenas variáveis atômicas, sem mutex, para não alterar o comportamento da solução. Ele conta violações quando: um passageiro embarca fora do estado de carregamento; o carro parte sem C passageiros a bordo; alguém desembarca fora do estado de descarregamento; a ordem de desembarque difere da de embarque (comparando senhas sequenciais); ou um carro termina o `unload` ainda com passageiros."),
  H2("3.2 Plano de teste"),
  P("Variou-se m em {1, 2, 5, 10, 15, 20, 25, 30, 40, 50}, com C = 4, R = 20, tL = 1 ms, tR = 10 ms e tU = 1 ms. Foram executados os três cenários do enunciado: (1) n = 200 fixo; (2) n = 2mC; (3) tL = tR = tU = 0, para isolar a sobrecarga pura dos semáforos. Como com R = 20 o cenário 3 dura poucos milissegundos, repetiu-se também com R = 200. A sensibilidade à capacidade usou C = 2 e C = 8 no cenário 2, com 10 repetições. Como cada carro faz R voltas, o trabalho total m·R·C cresce com m, e o speedup literal S(m) = T(1)/T(m) tende a valores menores que 1. Por isso reporta-se também o speedup de vazão S'(m) = λ(m)/λ(1) e a eficiência E(m) = S'(m)/m."),
  H2("3.3 Resultados e análise"),
  P(`**Corretude.** Em ${q1r.toLocaleString("pt-BR")} execuções (todos os cenários), o oráculo registrou ${q1v} violações. O CV ficou abaixo de 1,2% nos cenários 1 e 2 e na sensibilidade, atendendo ao critério de 5%.`),
  legenda("**Tabela 1** – Cenários 1 (n = 200) e 2 (n = 2mC), com C = 4 e 30 repetições"), tab1,
  fonte("Fonte: Elaborada pelos autores (2026). T, CV e λ são do cenário 1; no cenário 2 diferem em menos de 1%."),
  P("A vazão cresce quase linearmente até m = 10 (E = 0,96) e satura em cerca de 3.480 passageiros/s a partir de m = 15 (Figura 1b), com ganho máximo de 10,9 vezes e eficiência de 0,22 com 50 carros. O tempo total, que é constante até m = 10, passa a crescer linearmente (Figura 1a), porque cada carro adicional acrescenta R voltas a um sistema já saturado. O teto tem causa clara: o embarque é uma seção crítica serializada pelo anel, e cada carro ocupa a plataforma por cerca de 1,15 ms (o `usleep` de 1 ms mais a sinalização), de modo que no máximo C/1,15 ms ≈ 3.500 passageiros/s podem embarcar. É o efeito da Lei de Amdahl: a fração serial é tL/(tL + tR + tU) ≈ 1/11, e o joelho esperado fica em m ≈ 12,4/1,15 ≈ 11, valor coerente com a Figura 1c."),
  img("fig_q1_a.png", 15.5),
  legenda("**Figura 1** – Tempo, vazão, eficiência e latência de espera nos cenários 1 e 2"), fonte("Fonte: Elaborado pelos autores (2026). As barras indicam o desvio-padrão."),
  P(`A latência de espera difere entre os cenários. No cenário 2, com poucos carros, ela é de cerca de 13 ms (um passageiro espera, no máximo, o ciclo de outro grupo) e passa a crescer linearmente após a saturação, chegando a 94,8 ms com 50 carros, pois a fila cresce com n = 2mC enquanto a vazão é constante. No cenário 1, com n fixo, a espera cai de 119 ms (m = 1) para 44 ms, porque mais carros esvaziam a fila mais depressa, e se estabiliza no mesmo ponto de saturação. O uso de CPU é baixo: no cenário 2 sobe de ${R.q1_cpu_c2["1"]}% (m = 1) para ${R.q1_cpu_c2["50"]}% (m = 50), pois o sistema passa quase todo o tempo bloqueado, e as trocas de contexto chegam a cerca de ${R.q1_cs_c2["50"]} com 50 carros.`),
  legenda("**Tabela 2** – Cenário 3: sobrecarga de sincronização (tL = tR = tU = 0, R = 200, 30 repetições)"), tab2,
  fonte("Fonte: Elaborada pelos autores (2026)."),
  P("No cenário 3 (Tabela 2 e Figura 2a-b), o tempo por volta, T/(m·R), cresce de 11 µs (m = 1) para 21 µs (m = 50), e o CPU por volta acompanha esse valor, o que indica que o tempo é gasto em chamadas de semáforo. O número de trocas de contexto por volta é praticamente constante, de 14 a 16, ou seja, cerca de 3,5 por passageiro (acordar no embarque e no desembarque, mais a sinalização aos carros). O aumento do custo com m vem do maior número de threads disputando a única CPU. O CV ficou entre 10% e 22%, acima do critério de 5%: com tempos de poucos milissegundos, qualquer interferência do escalonador pesa muito, e por isso as conclusões se apoiam na tendência, que se repete na versão com R = 20 (de 16 µs a 26 µs por volta)."),
  img("fig_q1_b.png", 15.5),
  legenda("**Figura 2** – Sobrecarga sem trabalho simulado e sensibilidade à capacidade C"), fonte(),
  P("Na sensibilidade (Figura 2c), a vazão máxima é proporcional a C: cerca de 1.750, 3.480 e 6.760 passageiros/s para C = 2, 4 e 8, ou seja, C/1,15 ms. O ponto de saturação (m ≈ 10 a 15) não muda, pois depende apenas dos tempos tL, tR e tU. Em uma máquina com vários núcleos, a sobrecarga do cenário 3 deve ser maior, pois os despertares passam a cruzar CPUs, mas o teto de vazão continua determinado pela seção de embarque serializada."),

  H1("4 QUESTÃO 2 – TRAVESSIA DOS BABUÍNOS"),
  H2("4.1 Decisões de projeto"),
  P("Cada babuíno é uma thread com sentido d ∈ {0, 1}. A solução combina três mecanismos. O primeiro é um “interruptor” por sentido: o primeiro babuíno de cada sentido espera o semáforo `corda_livre` e o último a sair o libera, o que impede babuínos de sentidos opostos de estarem na corda ao mesmo tempo. O segundo é o semáforo de contagem `capacidade`, inicializado em 5. O terceiro é uma catraca FIFO, na qual o babuíno espera antes de tentar tomar a corda e que só libera depois que ele a tomou. Sem a catraca, um fluxo contínuo em um sentido mantém `corda_livre` sempre ocupado e o sentido oposto nunca entra."),
  P("A catraca precisa ser um semáforo *forte* (FIFO), pois o `sem_t` do POSIX não garante a ordem de despertar. Implementou-se um com um mutex e uma fila de nós, cada um com um semáforo próprio; ao liberar, a posse é passada diretamente ao primeiro da fila. Isso dá ausência de inanição: um babuíno espera, no máximo, os que chegaram antes dele, e cada um destes detém a catraca apenas até a corda ser liberada pelos que já estão atravessando, um tempo finito. Também não há deadlock, pois quem está na corda sai sem precisar da catraca."),
  H2("4.2 Plano de teste e metodologia"),
  P("Seguindo o enunciado, o oráculo usa um mutex independente da solução e mantém `na_corda[0]` e `na_corda[1]`, incrementados antes e decrementados depois da travessia, além do máximo total observado. Cada babuíno registra seus instantes de chegada, entrada e saída, e um *watchdog* declara suspeita de deadlock se ninguém concluir em 10 s com babuínos esperando. A travessia dura Tc = 100 ms, com variação aleatória de ±20%. Com um sentido por vez e no máximo 5 babuínos, a vazão teórica máxima é 5/Tc = 50 babuínos/s. Foram feitos quatro experimentos, com 10 repetições (sementes distintas) e três variantes: *justo* (a solução), *ingênuo* (sem catraca) e *nenhum* (sem sincronização, para validar o oráculo):"),
  ...bullets([
    "**A** – carga crescente: N ∈ {10, 25, 50, 100, 200}, 50% em cada sentido, todos chegando de uma vez;",
    "**B** – desbalanceamento: N = 100 com 50/50, 80/20 e 95/5, comparando justo e ingênuo;",
    "**C** – fluxo contínuo: N = 400, 97% no sentido 0, chegadas de Poisson a 48/s, para provocar inanição;",
    "**D** – taxa de chegada: N = 60 com 10, 25, 50 e 100 chegadas/s.",
  ]),
  H2("4.3 Resultados e análise"),
  P(`**Segurança, capacidade e vivacidade.** Nas ${R.q2_runs - R.q2_ctrl.runs} execuções das variantes justo e ingênuo, o oráculo registrou ${R.q2_viol_ok} violações de sentido ou de capacidade, o máximo observado na corda foi ${R.q2_maxtotal_ok} babuínos e o *watchdog* não disparou (${R.q2_deadlock} suspeitas de deadlock). Para validar a sensibilidade do oráculo, a variante *nenhum* violou as restrições em ${R.q2_ctrl.runs_com_viol} de ${R.q2_ctrl.runs} execuções, com em média ${R.q2_ctrl.viol_dir_media.toFixed(1).replace(".", ",")} entradas em sentido conflitante e ${R.q2_ctrl.viol_cap_media.toFixed(1).replace(".", ",")} acima da capacidade, chegando a ${R.q2_ctrl.max_total} babuínos na corda.`),
  legenda("**Tabela 3** – Experimento A: variante justa sob carga crescente (média ± DP, 10 repetições)"), tab3,
  fonte(),
  P("A vazão da solução justa é de cerca de 19 babuínos/s para qualquer N, e a espera média cresce linearmente com N (de 0,24 s para 5,2 s), comportamento típico de uma fila saturada. A vazão fica bem abaixo do limite de 50/s porque a fila FIFO preserva a ordem de chegada, que tem sentidos aleatórios: com N = 100 houve 51 trocas de sentido, em média só 2 babuínos por grupo, e cada troca exige esvaziar a corda (cerca de Tc). O tempo total, 5,43 s, é coerente com 51 trocas × 0,1 s."),
  legenda("**Tabela 4** – Experimento B: justo × ingênuo com N = 100 em rajada (média ± DP)"), tab4, fonte(),
  P("A Tabela 4 mostra o custo da justiça: a variante ingênua agrupa os babuínos por sentido (apenas 2 trocas) e chega a 48 babuínos/s, próximo ao limite, com espera média de 0,96 s contra 2,66 s no caso 50/50. A solução justa melhora conforme a carga fica mais desbalanceada (37,6/s no 95/5), pois há menos trocas. Em rajada, porém, a ingênua é eficiente apenas porque a fila é finita; o Experimento C mostra o que ocorre com fluxo contínuo."),
  img("fig_q2.png", 15.5),
  legenda("**Figura 3** – (a) vazão × carga; (b) vazão × taxa de chegada; (c) espera da minoria no fluxo contínuo"), fonte("Fonte: Elaborado pelos autores (2026). As barras indicam o desvio-padrão."),
  P(`No fluxo contínuo (Figura 3c), a variante ingênua deixa o sentido minoritário esperando em média ${R.t_q2c[0][3].split(" ")[0]} ms, com máximo médio de ${R.t_q2c[0][4].split(" ")[0]} ms e pior caso de ${Math.round(R.q2_c_raw.ingenuo.d1_max_max)} ms, praticamente toda a duração das chegadas (400/48 ≈ 8,3 s), enquanto a maioria espera só ${R.t_q2c[0][2].split(" ")[0]} ms: é a inanição que o enunciado pede para evitar. Com a catraca, as esperas dos dois sentidos se igualam (≈ ${R.t_q2c[1][3].split(" ")[0]} ms), o máximo da minoria cai para ${R.t_q2c[1][4].split(" ")[0]} ms em média (pior caso ${Math.round(R.q2_c_raw.justo.d1_max_max)} ms) e a vazão cai de ${R.t_q2c[0][1].split(" ")[0]} para ${R.t_q2c[1][1].split(" ")[0]} babuínos/s (−8%). No Experimento D (Figura 3b), com 10 chegadas/s a vazão acompanha a chegada (9,7/s) e a espera média é de 48 ms; a partir de 25/s o sistema satura em cerca de 18 babuínos/s e a espera cresce com a fila.`),

  H1("5 QUESTÃO 3 – CONSTRUINDO H2O"),
  H2("5.1 Decisões de projeto"),
  P("Cada thread, ao chegar, incrementa o contador do seu tipo sob um mutex. A thread que completa uma molécula (já há 1 O e 2 H) libera duas permissões em `fila_h` e uma em `fila_o`, decrementa os contadores e mantém o mutex; caso contrário, libera o mutex e espera na sua fila. Depois de liberada, a thread invoca `bond` e entra em uma barreira de 3 threads; apenas o oxigênio libera o mutex, depois da barreira. Isso garante a restrição central: a molécula seguinte só pode ser formada após as três threads da atual terem invocado `bond`, então qualquer sequência de saída dividida em grupos de três tem um O e dois H."),
  P("O mutex é um semáforo binário, e não um `pthread_mutex_t`, porque quem o trava (a thread que completa a molécula, O ou H) pode não ser quem o libera (sempre o O); liberar um `pthread_mutex_t` por outra thread é comportamento indefinido. A barreira foi implementada só com semáforos, em duas fases (duas catracas), para ser reutilizável a cada molécula. Se sobrarem threads sem par, elas ficam bloqueadas, como o enunciado prevê."),
  H2("5.2 Testes e resultados"),
  P("O teste registra a ordem em que `bond` é invocado e valida cada grupo de três. Os exemplos do enunciado produziram as saídas da Tabela 5; diferem das do enunciado na ordem dentro do grupo, o que é permitido. Para o estresse, K moléculas (K oxigênios e 2K hidrogênios) foram embaralhadas e executadas muitas vezes (Tabela 6). Como controle, uma variante sem nenhuma sincronização mostra que o teste detecta erros."),
  legenda("**Tabela 5** – Exemplos de entrada e saída"), tab5, fonte(),
  legenda("**Tabela 6** – Teste de estresse com entradas embaralhadas"), tab6, fonte(),
  P(`Em ${R.q3_total_ok.toLocaleString("pt-BR")} execuções com semáforos (até 3.000 threads cada), nenhuma produziu grupo inválido, enquanto a variante sem sincronização falhou em ${R.q3_ctrl[1]} de ${R.q3_ctrl[0]} execuções, o que confirma que o teste é capaz de detectar violações.`),

  H1("6 CONCLUSÃO"),
  P(`Na Questão 1, o anel de carros e as filas de desembarque por carro atenderam a todas as restrições (${q1v} violações em ${q1r.toLocaleString("pt-BR")} execuções). A vazão cresceu de forma quase linear até cerca de 10 carros e saturou em torno de 3.480 passageiros/s, limite imposto pela serialização do embarque (Lei de Amdahl), com eficiência de 0,22 com 50 carros; a sobrecarga de sincronização sem trabalho simulado ficou entre 11 µs e 21 µs por volta. Na Questão 2, a catraca FIFO com interruptor por sentido manteve segurança e capacidade em todas as execuções e eliminou a inanição, ao custo de menor vazão que a variante ingênua (justiça e eficiência são objetivos conflitantes). Na Questão 3, a barreira reutilizável de três threads garantiu moléculas completas em todas as execuções do estresse. Como limitação geral, todas as medições foram feitas em uma única CPU virtual; em máquinas com vários núcleos, espera-se maior sobrecarga de sincronização, mas os mesmos limites estruturais de vazão.`),

  new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT, children: [new TextRun({ text: "REFERÊNCIAS" })] }),
  ...[
    "ANDREWS, Gregory R. *Concurrent programming*: principles and practice. Redwood City: Addison-Wesley, 1991.",
    "DOWNEY, Allen B. *The little book of semaphores*. 2. ed. Needham: Green Tea Press, 2016.",
    "KERRISK, Michael. *The Linux programming interface*: a Linux and UNIX system programming handbook. San Francisco: No Starch Press, 2010.",
    "TANENBAUM, Andrew S. *Modern operating systems*. 2. ed. Upper Saddle River: Prentice Hall, 2001.",
    "TANENBAUM, Andrew S.; BOS, Herbert. *Sistemas operacionais modernos*. 4. ed. São Paulo: Pearson Education do Brasil, 2016.",
  ].map((t) => new Paragraph({ spacing: { line: 240, after: 200 }, children: runs(t) })),
];

const hd = (t, size, bold, before, after) => ({
  run: { font: FONT, size, bold, allCaps: false }, paragraph: { spacing: { before, after, line: 360 }, keepNext: true },
});
const doc = new Document({
  creator: "Ligia Cristina Aguiar Benedito; Pedro Fortunato Oliveira", title: "TP2 – Sincronização de threads com semáforos POSIX",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 120, line: 360 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 160, after: 80, line: 360 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "pts", levels: [{ level: 0, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1134, hanging: 425 } } } }] }] },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1701, left: 1701, right: 1134, bottom: 1134 } } }, children: capa },
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: { width: 11906, height: 16838 }, margin: { top: 1701, left: 1701, right: 1134, bottom: 1134, header: 709 }, pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
      children: body,
    },
  ],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(process.argv[2] || "/mnt/user-data/outputs/Relatorio_TP2_SO-LigiaA_PedroF.docx", b); console.log("ok"); });
