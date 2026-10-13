# world_rhythm — port C++ (Fase A do docs/CPP_STRATEGY.md)

Port da função pura `src/core/worldRhythm.ts` para C++, com **teste de
paridade** contra um corpus gerado pela implementação TypeScript real.

## O que prova

`parity_test` lê `corpus.txt` (gerado por `tests/world-rhythm-corpus.test.ts` a
partir das funções TS verdadeiras) e verifica que o C++ produz o mesmo output
para os mesmos inputs. Se os dois alguma vez divergirem (ex.: mudou uma
fronteira de fase num lado e não no outro), o teste falha com a linha exata.

## Estado do toolchain nesta máquina

- `g++` (MinGW/Strawberry): **disponível** → compila-se nativo e corre-se a paridade.
- `emcc` (Emscripten) / Docker: **não disponíveis** → o passo WASM fica aqui
  documentado para quando existirem.

## Compilar e correr (nativo)

```sh
cd native/cpp
g++ -std=c++17 -O2 -Wall -Wextra -o parity_test parity_test.cpp world_rhythm.cpp
./parity_test            # → "parity OK (N lines)" ; exit 0
```

Regenerar o corpus (depois de mudar regras no TS):

```sh
cd <repo>
npm run test -- --run tests/world-rhythm-corpus.test.ts   # escreve corpus.txt
```

## Passo WASM (quando houver Emscripten/Docker)

A mesma fonte compila para wasm com a API linear que o TS consumiria:

```sh
# com Docker:
docker run --rm -v $(pwd):/src -w /src/native/cpp emscripten/emsdk \
  em++ -std=c++17 -O3 -I. -o world_rhythm.wasm world_rhythm.cpp \
  -sEXPORTED_FUNCTIONS=_guinomo_day_phase,_guinomo_world_event_start,_guinomo_world_event_end,_guinomo_world_mood,_guinomo_next_world_event_start,_guinomo_next_world_event_end \
  -sEXPORTED_RUNTIME_METHODS=cwrap -sALLOW_MEMORY_GROWTH=1
```

Em TS, o `worldRhythm` expõe as mesmas funções e pode comutar internamente para
o wasm (o teste de paridade garante que nada muda de comportamento).

## Regra

Paridade testada **antes** de qualquer uso do wasm: o C++ só passa a ser o
"núcleo" quando `parity_test` estiver verde com o corpus atual.