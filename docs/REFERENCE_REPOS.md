# Repositórios externos — o que o Guinomo pode beneficiar

> Análise honesta (2026-10-13) dos 5 repositórios pedidos, mapeada ao
> `METAVERSE_ROADMAP.md`. Para cada um: o que é (com números reais da API do
> GitHub), a licença, **o que podemos usar já**, o que **não** devemos fazer,
> e onde encaixa nas ideias A1–C8.

---

## 1. sunkper/Project-Summer-Island — 89 ★, GDScript, sem push desde 2020

**O que é:** cena 3D de férias de verão feita em Godot Engine 3.2, recriação
(fan work) de uma cena de *Boku no Natsuyasumi 2* (2002). Pastas,
montanhas, casa de verão, luz dourada, puzzles leves. Criado como exercício de
aprendizagem, não como jogo.

**Licença:** os elementos originais são MIT, **MAS** é recriação de jogo
comercial + modelos/shaders de terceiros (ver `CREDITS.md`) → os assets **não
são seguros de copiar**. Inspiração sim, byte-por-byte não.

**O que podemos beneficiar:**
- **Direção de arte** para o Bloco A (mundo vivo) e os mundos `tropical-city` /
  `old-town` / hora dourada: escala humana, luz quente de fim de tarde, natureza
  nostálgica. É o tom "verão eterno" que já perseguimos no Guinomo.
- **Lição de pipeline:** ele construiu a casa e as geometrias com **Trenchbroom
  (editor de mapas Quake) + Qodot (importador Quake)→Godot**. = *level design
  por brushes + exportador* — o mesmo raciocínio que um futuro editor de cenário
  nosso faria (desenhar salas no editor, exportar a geometria).
- **Anti-padrões para nós:** abuso de GIProbes/reflection probes e pouca
  culling deram ~40fps numa GTX 1050Ti. Somos WebGL — a nossa disciplina de
  instancing/pontos/sem sombras pesadas é o caminho certo; isto confirma o porquê.

**Não fazer:** copiar modelos/texturas/código Godot para o Guinomo (licença +);
migrar código GDScript (stack incompatível).

**Encaixe:** mood board do **Bloco A**; o padrão `brush-level → export` como
referência para o **editor de cenário do pilar UGC** (ver §4).

---

## 2. 4ian/GDevelop — 27.5k ★, JavaScript, ativo diariamente

**O que é:** motor de jogos open-source sem código (no-code) para 2D/3D/multi,
exportável para HTML5; editor visual com "eventos" em blocos, mercado de
extensões, "vibe-coding" nas últimas versões.

**Licença:** open-source; o repositório declara licença própria GitHub
"NOASSERTION" (MIT na maioria dos componentes core) — **confirmar o LICENSE no
momento de qualquer integração**. Não planeamos integrar código, logo o risco é
baixo.

**O que podemos beneficiar:**
- **Modelo do pilar Economia/UGC:** o sistema de *Eventos + Extensões* mostra
  como deixar jogadores criar mini-atividades sem saber programar — exatamente o
  fosso que o nosso roadmap quer fechar (hoje o UGC é vazio).
- **Ciclo edita-anda:** hot-reload e catálogo de behaviors = o alvo de
  "experiência" para o nosso editor de cenários (ver §4) e para a
  **Inauguração (B6)** como momento editável por quem organiza encontros.
- **Filosofia "vibe-coding":** a abordagem deles de gerar jogos por intenção com
  IA é a mesma premissa de eu (agente) criar cenários para o Guinomo a partir de
  texto — valida o caminho, não o código.

**Não fazer:** embeber o motor GDevelop dentro do Guinomo (peso, stack
proprietária do editor); trocar o nosso WebGL por PixiJS deles.

**Encaixe:** **Pilar Economia/UGC** (roadmap) e o futuro **editor de cenários**.
Aprendizagem de arquitetura, zero dependência nova.

---

## 3. lettier/3d-game-shaders-for-beginners — 19.9k ★, C++/GLSL, livro-blog

**O que é:** tutorial passo-a-passo a implementar efeitos de shader 3D: SSAO,
depth of field, normal mapping, iluminação, fresnel, displacement, etc. O
material é o "manual do shader" mais consensual da web (também em site dedicado).

**Licença:** **não declarada (null na API)** → por defeito, código não pode ser
copiado sem permissão do autor. Ler/estudar é livre; copiar GLSL exige pedir ok.

**O que podemos beneficiar:**
- **Manual para as ideias A2 e A3** (que dependem do ok do teu WIP `glsl`):
  *maré/oceano* = vertex displacement + normal mapping (A2); *céu como estado*
  = atmosfera/scattering + máscaras por fase (A3).
- **Base para o teu próprio WIP** em `src/scene/glsl/`: os capítulos de
  iluminação/fresnel/fog ajudam a escrever os shaders que já estás a mexer.
- **Vocabulário comum** para o plano C++ (docs/CPP_STRATEGY.md): as mesmas
  técnicas existem em GLSL/WGSL quando a Fase C compilar shaders.

**Não fazer:** colar código do repo no `src/scene/glsl/` sem licença — se
quisermos reaproveitar um trecho, contactar o autor primeiro; mesmo assim,
preferir reescrever as técnicas à nossa medida (é um tutorial, não uma lib).

**Encaixe:** **A2 + A3** (com o teu ok), e o WIP `glsl` em curso.

---

## 4. pascalorg/editor — 24.8k ★, TypeScript, MIT — **o mais acionável**

**O que é:** editor 3D arquitetónico open-source (three.js/react-three-fiber),
**local-first**, com **CLI local + ferramentas MCP** e fluxos "trabalho para
humanos e agentes de IA". Milhares de forks em menos de um ano — o fenómeno do
"editor que agentes usam".

**Licença:** MIT ✓ (podemos adaptar padrões/código com atribuição).

**Porque é o mais acionável para nós:**
- **Responde diretamente ao "criar cenários":** é o padrão de que precisamos
  para um **editor de mundos do Guinomo** — cena em JSON + three.js + local
  CLI. Os nossos mundos são gerados por código (`structures`, `worldLocations`);
  um schema tipo o deles permitiria desenhar cenários (casas, spots, objetos de
  B5) e exportar JSON que o motor lê.
- **MCP + agente:** o próprio propósito deles — "agentes de IA usam o editor via
  MCP" — é o meu fluxo futuro: eu gerar/editar cenas do Guinomo por ferramenta,
  em vez de escrever ficheiros à mão.
- **Local-first** bate certo com a nossa filosofia determinística (estado
  derivável, sem servidor obrigatório).

**Não fazer:** portar o app inteiro (é CAD/BIM/arquitetura, pesado, React — a
nossa stack é three.js puro + módulos `SceneModule`); meter dependência nova no
`package.json` agora.

**Encaixe:** **B5 Polaroids/objetos no mundo** (schema de cena) e o futuro
**editor UGC** (pilar Economia). Primeiro passo concreto sem custo: definir um
`scenario.json` (primitivas + posições determinísticas) que `worldLocations`
passe a consumir.

---

## 5. aframevr/aframe — 17.7k ★, JavaScript, MIT, WebXR

**O que é:** framework web declarativo para VR/AR sobre **three.js** (o mesmo
motor-base do Guinomo!). Primitivas + sistema de componentes (ECS), exporta para
WebXR (Quest, headset). "O OASIS web" no espírito mais literal.

**Licença:** MIT ✓.

**O que podemos beneficiar:**
- **Prova de que WebXR sobre three.js funciona:** o caminho "metaverso acessível
  no browser" que o roadmap defende é o deles com ~9 anos de produção.
- **Padrão ECS/declarativo:** o modelo `entity + components + primitives` é
  traduzível para a nossa `SceneModule` — cenários declarativos (ver §4)
  poderiam descrever-se como entidades, não como objetos imperativos.
- **VR opcional:** a **Inauguração (B6)** e a futura sala-álbum (B5) poderiam
  ganhar um modo VR real (o alinhamento celestial é um ótimo candidato a momento
  WebXR partilhado). Um overlay A-Frame num mundo dedicado é mais barato do que
  portar o motor.

**Não fazer:** substituir o nosso WebGL pelo A-Frame (colide com o motor e com o
WIP do utilizador); carregar A-Frame no bundle principal — só como camada
opcional/VR.

**Encaixe:** **B6** (modo VR do alinhamento, futuro), **C7** (finale imersivo),
e o sonho OASIS do roadmap — como referência de padrões, não como dependência.

---

## Resumo executivo

| Repo | Licença | Uso no Guinomo | Prioridade |
|---|---|---|---|
| Project-Summer-Island | MIT (caveats) | Mood/arte do Bloco A; lição de pipeline | Inspiração |
| GDevelop | Open-source (confirmar) | Modelo do pilar UGC; filosofias | Referência |
| 3d-game-shaders… | **Sem licença** | Manual para A2/A3 e WIP glsl (ler, não copiar) | Referência |
| pascalorg/editor | MIT ✓ | Editor de cenários + MCP + schema JSON | **Acionável** |
| A-Frame | MIT ✓ | Padrões ECS/declarativo; VR opcional (B6/C7) | Referência |

**Regra dura:** nenhum destes entra no `package.json`. Todos entram como
referência de padrões; só `pascalorg/editor` e `aframe` permitem (MIT) a
adaptação real de conceitos — e mesmo esses, adaptados, nunca "vendored" em
bloco.