# Pipeline offline de dades

Aquest directori conté l'únic codi Python del projecte. **Sempre s'executa
localment, mai a CI ni al navegador.** Cap d'aquests scripts forma part del
build de GitHub Pages: converteixen dades cru en els fitxers estàtics
(`.parquet` + `.json`) que l'app React llegeix en temps d'execució.

## Invocació: sempre `uv run`, mai l'intèrpret del sistema

Tots els scripts d'aquest directori porten una capçalera PEP 723
(`# /// script ... ///`) i s'invoquen **exclusivament** així:

```bash
uv run scripts/<nom>.py [arguments]
```

**Mai** amb `python3 scripts/<nom>.py`. L'intèrpret `python3` per defecte
d'aquesta màquina és massa antic per a `pandas`/`pyarrow` (vegeu
`.planning/phases/02-offline-data-pipeline/02-RESEARCH.md` Pitfall 1). `uv
run` resol un Python >=3.11 i les dependències declarades a la capçalera
del script sense necessitat de `venv` ni `requirements.txt` — no hi ha cap
altra via d'invocació suportada.

## `convert_enquesta.py` — conversió de dades reals

Converteix un export CSV cru (una fila per enquestat, una columna per
pregunta — el format estàndard de Google Forms/Typeform) en els tres
artefactes publicats.

### Flags

| Flag | Obligatori | Descripció |
|------|------------|------------|
| `input_csv` (posicional) | sí | Camí a l'export CSV |
| `--id` | sí | Identificador de l'enquesta (`^[A-Za-z0-9._-]{1,64}$`) |
| `--columns` | sí* | Llista de columnes permeses, separades per comes |
| `--title` | sí* | Títol de l'enquesta |
| `--description` | sí* | Descripció de l'enquesta |
| `--date` | no | `YYYY-MM-DD` (per defecte: avui en UTC) |
| `--out-dir` | no | Directori de sortida (per defecte: `public/data`) |
| `--sheet` | no | Nom del full a llegir en entrades `.xlsx` (per defecte: el primer full) |
| `--list-columns` | no | Mode d'inspecció: només imprimeix columnes i surt |
| `--confirm-privacy-review` | no | Requerit per escriure quan el checklist troba indicis |

\* No obligatori en mode `--list-columns`.

### Codis de sortida

| Codi | Significat |
|------|------------|
| `0` | Èxit (conversió o inspecció) |
| `1` | Error d'ús o d'entrada (CSV il·legible, `--id` invàlid, columna no trobada) |
| `2` | El checklist de privacitat ha trobat indicis i no s'ha passat `--confirm-privacy-review` |

### El checklist de privacitat bloqueja per defecte

Cada execució contra dades reals corre `pipeline.privacy.run_privacy_checklist`,
que **sempre imprimeix** el seu informe (fins i tot quan no troba res —
"Cap indici detectat."). Si troba una columna gairebé única o una combinació
de poca cardinalitat amb un grup massa petit, **bloqueja l'escriptura** amb
el codi de sortida `2` fins que es torni a executar amb
`--confirm-privacy-review`. No hi ha manera de saltar-se aquest pas sense
llegir l'informe primer.

### Fluxos de treball recomanat per a un export real

1. **Inspecciona les columnes**: `uv run scripts/convert_enquesta.py <csv> --list-columns`
2. **Tria l'allow-list** de columnes a partir de la sortida anterior
3. **Executa sense `--confirm-privacy-review`** per veure el checklist de privacitat
4. **Llegeix el checklist** — revisa cada indici (columnes gairebé úniques, grups petits)
5. **Torna a executar amb `--confirm-privacy-review`** només un cop revisats els indicis

### Les columnes de text lliure s'exclouen sempre (D-02)

Qualsevol columna detectada com a text lliure (longitud mitjana > 60
caràcters, o gairebé única amb mitjana > 25 caràcters) es descarta
**incondicionalment**, encara que estigui explícitament a `--columns`. No hi
ha cap flag per tornar-la a incloure — és una decisió de disseny (D-02), no
un valor per defecte modificable: un cop una enquesta s'ha publicat sense
una columna de text lliure, tornar-la a afegir requereix reprocessar i
tornar a publicar les seves dades.

## `generate_mock_parquet.py` — dades sintètiques

Genera una enquesta sintètica **sense cap fitxer d'entrada i sense dades
reals**. No importa `pipeline.privacy` ni accepta cap bandera de
confirmació — no hi ha cap respondent real a protegir.

### Flags

| Flag | Descripció |
|------|------------|
| `--id` | Identificador de l'enquesta (per defecte: `mostra-sintetica`) |
| `--n` | Nombre de respostes a generar (per defecte: `250`; `--n 0` genera un Parquet vàlid de zero files amb l'esquema complet de sis columnes) |
| `--seed` | Llavor per al generador determinista (per defecte: `42`; la mateixa llavor produeix sortida byte-idèntica) |
| `--out-dir` | Directori de sortida (per defecte: `public/data`) |

Reutilitza `pipeline.infer.build_fields`/`build_kpis` i
`pipeline.index.compute_upserted_index`, així que la forma de la sortida sintètica
és idèntica a la de la conversió real (mateixa regla D-03 de tipatge de
columnes, mateix upsert d'índex).

## `pipeline_selftest.py` — suite de proves

```bash
uv run scripts/pipeline_selftest.py -v
```

Executa la suite `unittest` de la biblioteca estàndard sobre els mòduls
purs de `scripts/pipeline/` (`schema`, `infer`, `index`, `privacy`) — sense
tocar cap fitxer real ni escriure a `public/data/`.

## On aterren els artefactes — i que són públics per sempre

Els tres scripts anteriors escriuen (o llegeixen) dins de:

- `<out-dir>/enquestes/<id>_respostes.parquet`
- `<out-dir>/enquestes/<id>_meta.json`
- `<out-dir>/enquestes_index.json` (upsertat per `id`, mai sobreescrit sencer)

Per defecte, `<out-dir>` és `public/data/`. **Tot el que es comet sota
`public/data/` és permanent: forma part de l'historial públic de git i es
serveix a qualsevol visitant del lloc de GitHub Pages des del següent
desplegament.** No hi ha manera de "retirar" un fitxer publicat sense
reescriure l'historial de git — tracta cada conversió cap a `public/data/`
com una publicació irreversible.

## Visualitzar el resultat localment

```bash
npm run preview:pages
```

Serveix `dist/` reproduint el comportament de fallback de `404.html` de
GitHub Pages (que `vite preview` per si sol no reprodueix), per confirmar
que el catàleg i les dades generades es veuen correctament abans de fer
push.
