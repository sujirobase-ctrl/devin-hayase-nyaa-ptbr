# Hayase Nyaa PT-BR

Extensão para o [Hayase](https://hayase.watch) que indexa releases de anime em **PT-BR** (legendado e dublado) hospedadas no [Nyaa.si](https://nyaa.si).

A extensão consulta o feed RSS público do Nyaa, filtrando por marcadores PT-BR e por fansubs brasileiras conhecidas, e devolve **magnet links** para o Hayase reproduzir via WebTorrent. **Nenhum encurtador, login ou conteúdo é hospedado por esta extensão** — ela apenas consulta uma fonte pública existente.

## Como instalar no Hayase

1. Abra o Hayase.
2. Vá em **Settings → Extensions → Import Extensions** (ou na aba **Repositories**).
3. Cole a URL do manifesto:

   ```
   https://raw.githubusercontent.com/sujirobase-ctrl/devin-hayase-nyaa-ptbr/main/index.json
   ```

4. Clique **Import Extensions** e habilite a extensão "Nyaa PT-BR".

## O que está incluso

- `index.json` — manifesto que o Hayase consome para descobrir a extensão.
- `nyaa-ptbr.js` — script da extensão (Web Worker), expõe `single`, `batch`, `movie`, `test`.
- `abstract.js` — classe base seguindo o exemplo oficial [`hayase-app/free-torrents`](https://github.com/hayase-app/free-torrents).
- `types.d.ts` — tipagens auxiliares (informativas, sem dependência de build).

## Critérios de inclusão

Um resultado do Nyaa só é retornado para o Hayase se o título contiver pelo menos um destes marcadores (case-insensitive):

- `PT-BR`, `PTBR`, `[BR]`, `(BR)`
- `Português` / `Portugues`
- `Brasil` / `Brazilian`
- `Dublado`, `Legendado`
- Tag de fansub PT-BR conhecida: `[Anitsu]`, `[WF]`, `[FênixFansub]`, `[Anime no Sekai]`, `[Kekkan]`, `[SubVision]`, `[HollowStudios]`, `[AYA]`, `[Sully FANSUB]`, `[Punch Sub]`, `[CocaSubs]`, `[Trix]`.

Além disso a extensão respeita os filtros do Hayase:

- `resolution` — descarta releases abaixo da resolução solicitada.
- `exclusions` — descarta releases que contenham qualquer keyword de exclusão (ex.: codec ou áudio não suportado pelo dispositivo).

## Métodos

| Método | O que faz |
| --- | --- |
| `single(query)` | Retorna releases que provavelmente contêm o `query.episode`. Prioriza casos `SxxEyy`, episódios soltos (`- 06`) e batches que cubram o episódio. |
| `batch(query)` | Retorna apenas releases que parecem batches/temporadas completas (`BD`, `S01`, `01-12`, `Complete`, `Completo`, `Saga`). |
| `movie(query)` | Retorna releases marcadas como filme (`Movie`, `Filme`, `劇場版`). |
| `test()` | Verifica o RSS público do Nyaa e a presença de releases PT-BR. |

## Aviso legal

Este projeto **não hospeda nenhum conteúdo**. Ele apenas indexa metadata publicamente disponível no Nyaa.si. O usuário é responsável por respeitar as leis de direitos autorais da sua jurisdição.

## Licença

[MIT](./LICENSE)
