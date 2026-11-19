/* =====================================================================
   modulos.js — LISTA ÚNICA DE MÓDULOS
   Para adicionar um módulo novo, acrescente um bloco igual aos de baixo.
   Este mesmo arquivo deve ficar em dois lugares:
     1) na raiz do portal (publicado no GitHub)
     2) ao lado do painel.html (na sua pasta painel-admin)
   ===================================================================== */
(typeof window!=="undefined"?window:self).FF_MODULOS = [
  {
    id: "musculo",                       // identificador (sem espaços/acentos). NUNCA mude depois de emitir códigos
    nome: "MusculoApp",                  // nome mostrado
    semestre: "2º semestre",             // aparece ao lado do nome (apague a linha para não mostrar)
    emoji: "💪",
    pasta: "musculo",                    // pasta do módulo dentro do portal
    descricao: "54 músculos: origem, inserção e ação · quiz e estudo",
    cor: ["#fde68a", "#fb923c"]          // degradê do ícone na página inicial
  },
  {
    id: "farma",
    nome: "FarmaFund",
    semestre: "2º semestre",
    emoji: "💊",
    pasta: "farma",
    descricao: "Fundamentos da Prática Farmacêutica · 30 questões e cálculos animados",
    cor: ["#a7f3d0", "#14b8a6"]
  }
];
