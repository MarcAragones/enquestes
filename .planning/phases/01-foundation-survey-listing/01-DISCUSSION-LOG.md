# Phase 1: Foundation & Survey Listing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 1-Foundation & Survey Listing
**Areas discussed:** Disseny visual

---

## Disseny visual

**Q: Quina paleta de colors vols per l'app?**

| Option | Description | Selected |
|--------|-------------|----------|
| Neutra/minimalista | Blanc-negre-grisos amb un sol color d'accent | ✓ |
| Colorida/vibrant | Colors variats per categoritzar visualment les enquestes | |
| Fosca per defecte | Dark mode com a base de l'aplicació | |

**Q: Vols suport per canviar entre mode clar i fosc?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, amb toggle | Canvi clar/fosc, respecta la preferència del sistema per defecte | ✓ |
| No, només un mode | Un sol tema fix, sense selector | |

**Q: Com han de ser visualment les targetes d'enquesta a la graella?**

| Option | Description | Selected |
|--------|-------------|----------|
| Només text | Títol, data, descripció i N participants, sense imatge ni icones | ✓ |
| Amb icona/emoji | Icona o emoji representatiu de la temàtica | |
| Amb mini-gràfic de preview | Sparkline/gràfic dins la targeta com a tast visual | |

**Q: Quin estil tipogràfic/vibe general vols?**

| Option | Description | Selected |
|--------|-------------|----------|
| Modern/tech | Sans-serif net, tipus eina SaaS/dashboard de dades | ✓ |
| Editorial/humanista | Més càlid, tipus revista de dades o informe periodístic | |

**Notes:** Cap aclariment addicional més enllà de les respostes seleccionades.

---

## Claude's Discretion

- Estratègia de routing (`BrowserRouter`+`404.html` vs `HashRouter`) — usuari va delegar la decisió
- Flux del resum ràpid en clicar una targeta (modal vs ruta dedicada) — usuari va delegar la decisió
- Estat buit del catàleg (sense enquestes publicades encara) — usuari va delegar la decisió
- Idioma de la interfície — no discutit explícitament; assumit català per consistència amb tot el context del projecte

## Deferred Ideas

None — discussion stayed within phase scope.
