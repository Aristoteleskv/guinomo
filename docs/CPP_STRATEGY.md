# C++ no Guinomo: onde ganha, onde é balão, e como entrar

> Documento vivo. Resposta direta a "se envolvermos C++, qual o ganho?".
> Tese: **o C++ não resolve os problemas de hoje — resolve os de amanhã.**
> Entra apenas quando houver (a) métricas reais de hotspot ou (b) a decisão de
> servidor autoritativo com simulação determinística. Até lá, é dívida
> técnica disfarçada de ambição.

## 1. O estado atual (factos)

- Motor WebGL vanilla TypeScript/three.js; 6 mundos procedurais; P2P
  multiplayer já corre em **Rust compilado a wasm** (iroh-gossip).
- Server-side: PHP (perfil, presença, troféus, spawn) + PDO/file stores.
- Gargalos de hoje: conteúdo, social, retenção, bundle — **não CPU**.

## 2. Onde o C++ (via Emscripten → wasm) ganha de verdade

| Área | Ganho | Quando justifica |
|---|---|---|
| **Simulação determinística** (netcode) | Uma binária (C++→wasm) corre no browser e no servidor com a mesma aritmética/tick ⇒ rollback/lag-compensation barato, desportos/duelos justos | Quando houver gameplay competitivo no mundo |
| **Computação pesada** | navmesh/pathfinding em malhas grandes, física determinística, IA de massas, ruído/geração procedural em escala | Quando o profiler mostrar hotspot real |
| **Servidor autoritativo** | Game loop tickado determinístico p/ >dezenas por sala; hierarquia de aspetos | Fase 4 do roadmap (antes disso, P2P basta) |

### Onde o C++ **não** ganha (vão tentar vender-te)
- **Frame rate**: draw calls/instancing/ktx2 resolve-se em TS + tuning. Não é aí.
- **Multiplayer atual**: já é Rust/wasm. C++ seria trocar de ferramenta sem obra.
- **Bundle size**: any wasm come >50 KB; um módulo C++ de simulação passa dos
  500 KB a 1 MB — paga-se em tempo de carga a menos que seja usado a sério.

## 3. Determinismo: o que já temos e o que falta

Já existe estado determinístico por relógio no cliente:
- `src/core/goldenHour.ts` — janela diária (FNV-1a, dia **local**).
- `src/core/worldRhythm.ts` — fases do dia + evento diário por mundo + `worldMood`
  (FNV-1a, dia **UTC**; mesmo estado para todos; **puro, sem DOM/rede**).

O `worldRhythm` é o primeiro "núcleo determinístico" do projeto: é o candidato
perfeito para o POC de wasm, porque é uma função pura `(mundo, minutos) → estado`.

## 4. Plano de adoção em 3 fases

### Fase A — Prova de conceito (dias, baixo risco)
1. Toolchain: Emscripten via Docker (`emscripten/emsdk`) — nada instalado na máquina.
2. Portar `worldRhythm` para C++ (`world_rhythm.cpp`): mesmas funções puras.
3. Compilar para wasm e expor com uma API linear `(world_id, minutes) -> state`.
4. Teste de paridade: baterias de casos iguais em TS e C++ (golden tests).
5. **Critério de go/no-go**: o módulo wasm tem de ser mais rápido *e* mais
   pequeno de manter do que o TS; se não for, para aqui e não se continua.

### Fase B — Núcleo de simulação única (semanas)
1. Migrar o "estado do mundo" (fases, eventos, marés, clima) para o binário wasm.
2. TS passa a chamar o núcleo (bindings finos escondidos atrás das interfaces
   atuais — `worldRhythm` mantém a mesma assinatura, os testes de paridade
   garantem que nada muda).
3. O mesmo módulo compila para **server build** (servidor autoritativo futuro).

### Fase C — Servidor autoritativo (meses, só se o jogo exigir)
1. Servidor em Rust (o projeto já usa Rust) ou C++ — não é dogma da stack:
   Rust partilha a linguagem do iroh; C++ partilha simulação compilada.
2. Rooms >dezenas, desportos/duelos com netcode determinístico.
3. Regra dura: nada disto antes de **métricas de profiler** pedirem.

## 5. Regras de engajamento (para não cair no "C++ porque sim")

1. **Nunca antes das métricas.** Hotspot real → discutir C++.
2. **Uma binária, dois lados.** O valor máximo vem de cliente+servidor a partilhar
   simulação; só cliente é custo sem retorno.
3. **O interface é TS.** O wasm fica escondido atrás das mesmas funções; o resto
   do projeto nem sabe que existe.
4. **Paridade testada.** Conjunto de casos partilhado TS↔C++ (golden tests) —
   a deriva entre os dois é o bug mais caro possível.

## 6. Estado atual do plano

- [x] Núcleo determinístico puro em TS (`worldRhythm` + `goldenHour`).
- [ ] Fase A: POC wasm com teste de paridade (espera a tua decisão).
- [ ] Fase B/C: conforme roadmap e métricas.

Próximo passo concreto se quiseres: **Fase A** (container Emscripten + port
`world_rhythm.cpp` + golden tests) — meio dia de trabalho, fornece a resposta
experimental ao "e se for C++?": medimos a verdade em vez de discutir opinião.