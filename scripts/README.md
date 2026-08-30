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
| `--columns` | no | Llista de columnes permeses, separades per comes. Si s'omet, es conserven totes les columnes carregades abans dels filtres de text lliure (D-02) i cardinalitat (D-01) |
| `--title` | sí* | Títol de l'enquesta |
| `--description` | sí* | Descripció de l'enquesta |
| `--max-cardinality` | no | Llindar de valors distints per sobre del qual una columna es descarta automàticament (D-01); per defecte `20` |
| `--include-columns` | no | Llista de columnes a mantenir malgrat superar el llindar de cardinalitat, separades per comes (D-04); no evita mai l'exclusió incondicional de text lliure (D-02) |
| `--date` | no | `YYYY-MM-DD` (per defecte: avui en UTC) |
| `--out-dir` | no | Directori de sortida (per defecte: `public/data`) |
| `--sheet` | no | Nom del full a llegir en entrades `.xlsx` (per defecte: el primer full) |
| `--list-columns` | no | Mode d'inspecció: només imprimeix columnes i surt |
| `--confirm-privacy-review` | no | Requerit per escriure quan el checklist troba indicis |
| `--skip-privacy-review` | no | Omet completament el càlcul del checklist de privacitat (no només el bloqueig); només per a fonts ja anonimitzades i verificades per l'operador. S'ha de passar explícitament a cada execució. |

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
llegir l'informe primer, **tret que s'invoqui explícitament amb
`--skip-privacy-review`** (vegeu la taula de flags): en aquest cas el
checklist ni tan sols es calcula, i és responsabilitat exclusiva de
l'operador haver-ne verificat la font per endavant.

### Fluxos de treball recomanat per a un export real

1. **Inspecciona les columnes**: `uv run scripts/convert_enquesta.py <csv> --list-columns` — cada línia mostra el marcador de llindar de cardinalitat (D-01) per llegir d'un cop d'ull què es descartaria per defecte
2. **Executa sense `--columns`**: la selecció automàtica per cardinalitat (D-01) substitueix l'enumeració manual per defecte. Llegeix tant l'informe d'exclusió per cardinalitat com el checklist de privacitat que s'imprimeixen
3. **Recupera columnes mal excloses** amb `--include-columns nom1,nom2` si el llindar per defecte ha descartat alguna columna que vols mantenir
4. **Estreny explícitament amb `--columns`** només si vols un allow-list més restrictiu que l'heurística per defecte
5. **Llegeix el checklist de privacitat** — revisa cada indici (columnes gairebé úniques, grups petits)
6. **Torna a executar amb `--confirm-privacy-review`** només un cop revisats els indicis

### Les columnes de text lliure s'exclouen sempre (D-02)

Qualsevol columna detectada com a text lliure (longitud mitjana > 60
caràcters, o gairebé única amb mitjana > 25 caràcters) es descarta
**incondicionalment**, encara que estigui explícitament a `--columns` o a
`--include-columns`. No hi ha cap flag per tornar-la a incloure — és una
decisió de disseny (D-02), no un valor per defecte modificable: un cop una
enquesta s'ha publicat sense una columna de text lliure, tornar-la a afegir
requereix reprocessar i tornar a publicar les seves dades.

### Les columnes de cardinalitat alta s'exclouen per defecte (D-01)

Qualsevol columna amb més de `--max-cardinality` valors distints (per
defecte **20**, `MAX_DISTINCT_VALUES`) es descarta **per defecte**. Es
tracta d'un **recompte absolut** de valors distints, deliberadament **no**
escalat al nombre de files: un export de 24 files i un de 2000 files
descarten una columna al mateix recompte de valors distints. `--max-cardinality`
canvia aquest llindar. Cada columna descartada es reporta pel seu nom i el
seu recompte de valors distints abans que la baixa faci efecte;
`--include-columns nom1,nom2` recupera una columna concreta malgrat superar
el llindar.

Aquest és un **tercer filtre independent** que ni substitueix ni és
substituït per l'exclusió de text lliure (D-02) ni pel checklist de
privacitat: una columna pot ser descartada per qualsevol dels tres per
separat. En particular, **`--include-columns` no pot ni podrà mai** recuperar
una columna que l'exclusió de text lliure ja ha descartat (D-02 és
incondicional, vegeu la secció anterior).

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

## `verify_publicacio.py` — integritat de la publicació

```bash
uv run scripts/verify_publicacio.py
```

Comprova que `enquestes_index.json`, cada `<id>_meta.json` i cada
`<id>_respostes.parquet` sota `--data-dir` són mútuament consistents:
l'esquema de l'índex (`schema.validate_index`), ids duplicats, presència
dels dos fitxers per a cada entrada de l'índex, l'esquema de cada meta
(`schema.validate_meta`) i que hi coincideix amb la seva entrada de
l'índex, que `n` del meta coincideix amb el recompte de files del Parquet,
que el conjunt de noms de `fields` del meta coincideix amb l'esquema de
columnes del Parquet, i que no hi ha cap fitxer orfe (un `_respostes.parquet`
o `_meta.json` sense entrada corresponent a l'índex). Reutilitza
`pipeline.schema.validate_index`/`validate_meta` en comptes de
reimplementar el contracte publicat, i només llegeix metadades de Parquet
(recompte de files i noms de columnes) — mai cap valor de cel·la.

### Flags

| Flag | Descripció |
|------|------------|
| `--data-dir` | Directori que conté `enquestes_index.json` i el subdirectori `enquestes/` (per defecte: `public/data`) |
| `--expect-ids` | Llista d'ids separats per comes que l'índex ha de contenir exactament, ni de més ni de menys (opcional) |

### Codis de sortida

| Codi | Significat |
|------|------------|
| `0` | Totes les comprovacions han passat |
| `1` | Alguna comprovació ha fallat, o l'índex no existeix, no es pot llegir o no compleix l'esquema |

Executa'l **després de qualsevol conversió que escrigui a `public/data/`, i
abans de fer commit** — és la comprovació mecànica que l'upsert de l'índex
no ha perdut ni duplicat cap entrada i que cada Parquet publicat encara
coincideix amb el seu meta.

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
com una publicació irreversible. Executa `uv run scripts/verify_publicacio.py`
per confirmar que el conjunt publicat és consistent abans que aquest commit
esdevingui permanent.

## Visualitzar el resultat localment

```bash
npm run preview:pages
```

Serveix `dist/` reproduint el comportament de fallback de `404.html` de
GitHub Pages (que `vite preview` per si sol no reprodueix), per confirmar
que el catàleg i les dades generades es veuen correctament abans de fer
push.
