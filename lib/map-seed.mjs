export const MAP_SEED = {
  locations: [
    { id: "sede", name: "Sede / Centro", region: "Sede", lon: -39.586, lat: -3.686, labelDx: 18, visible: true },
    { id: "baixa-grande", name: "Baixa Grande", region: "Zona rural sul", lon: -39.66, lat: -3.73, labelDx: -16, visible: true },
    { id: "camara", name: "Camará", region: "Distritos", lon: -39.52, lat: -3.70, labelDx: 16, visible: true },
    { id: "cruz", name: "Cruz", region: "Zona rural norte", lon: -39.62, lat: -3.65, visible: true },
    { id: "pitombeira", name: "Pitombeira", region: "Zona rural sul", lon: -39.55, lat: -3.76, visible: true },
    { id: "sao-jose", name: "São José", region: "Sede", lon: -39.60, lat: -3.70, labelDy: 16, visible: true },
    { id: "pedra-do-frade", name: "Pedra do Frade", region: "Serra", lon: -39.57, lat: -3.645, visible: true },
    { id: "alto-torres", name: "Alto das Torres", region: "Serra", lon: -39.595, lat: -3.668, labelDy: -14, visible: true }
  ],
  deliveries: [
    {
      id: "demo-sede-educacao", locationId: "sede", type: "Emenda",
      title: "Acompanhamento de demanda escolar na sede",
      summary: "Conteúdo demonstrativo para o mapa. Não representa emenda liquidada nem entrega oficial.",
      value: 180000, status: "Em andamento", date: "2026-03-12",
      image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-sede-calcada", locationId: "sede", type: "Obra",
      title: "Fiscalização de melhorias em vias do centro",
      summary: "Exemplo editorial de registro de obra acompanhada pelo mandato.",
      value: 420000, status: "Planejado", date: "2026-05-02",
      image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-baixa-ponte", locationId: "baixa-grande", type: "Obra",
      title: "Diálogo sobre acesso e infraestrutura rural",
      summary: "Registro demonstrativo de escuta na comunidade de Baixa Grande.",
      value: 250000, status: "Em andamento", date: "2026-04-18",
      image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-camara-saude", locationId: "camara", type: "Projeto",
      title: "Proposta de atendimento mais próximo em Camará",
      summary: "Item demonstrativo de projeto em discussão com a comunidade.",
      value: 95000, status: "Planejado", date: "2026-06-08",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-frade-turismo", locationId: "pedra-do-frade", type: "Projeto",
      title: "Valorização do cartão-postal da Pedra do Frade",
      summary: "Conteúdo demonstrativo sobre patrimônio natural e visitação responsável.",
      value: 0, status: "Planejado", date: "2026-07-01",
      image: "assets/itapaje-hero.png",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-cruz-agua", locationId: "cruz", type: "Emenda",
      title: "Registro de demanda hídrica na comunidade Cruz",
      summary: "Exemplo de ponto mapeado para acompanhamento. Substitua por dados oficiais no painel.",
      value: 130000, status: "Em andamento", date: "2026-02-20",
      image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-sao-jose-praca", locationId: "sao-jose", type: "Obra",
      title: "Acompanhamento de espaço comunitário em São José",
      summary: "Registro demonstrativo de escuta sobre espaços públicos no bairro.",
      value: 110000, status: "Planejado", date: "2026-05-20",
      image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-pitombeira-estrada", locationId: "pitombeira", type: "Emenda",
      title: "Demanda de acesso rural em Pitombeira",
      summary: "Exemplo de ponto mapeado para acompanhamento de via rural.",
      value: 200000, status: "Em andamento", date: "2026-04-02",
      image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    },
    {
      id: "demo-alto-torres", locationId: "alto-torres", type: "Projeto",
      title: "Olhar para o Alto das Torres e o entorno da serra",
      summary: "Item demonstrativo de acompanhamento da paisagem e das comunidades da serra.",
      value: 0, status: "Planejado", date: "2026-07-12",
      image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
      video: "", photos: [], demo: true
    }
  ]
};
