# Infrastructure Telemetry Analyzer & AI Diagnostic Engine

Pipeline d'ingestion, d'audit statistique et de recommandation SRE automatisée construit avec NestJS, Clean Architecture
et Mastra (Google Gemini 3.8 Flash).

## 1. Pourquoi la Clean Architecture ? (Vision & Principes)

Déléguer l'ensemble d'un traitement de logs à un LLM en un seul bloc crée un système lent, coûteux, non déterministe et
difficile à maintenir. La Clean Architecture résout ce problème en posant quatre garde-fous :

- **Le LLM comme détail d'implémentation (Inversion de Dépendance)** : Le calcul des moyennes
  (`SummarizeMetricsService`) et le filtrage sur seuils (`AnomalyMetricsService`) sont purement déterministes et
  s'exécutent en mémoire en quelques millisecondes. L'agent Mastra est isolé derrière un port secondaire
  (`DiagnosticGatewayContract`) et n'intervient qu'en fin de chaîne sur des données déjà qualifiées, ce qui maîtrise la
  latence, la taille du contexte et les coûts d'inférence.
- **Protection du Domaine via Anti-Corruption Layer ** : Les modèles métier (`core/`) sont des *Value Objects* immuables
  (`readonly`) indépendants des formats externes. Zod n'est utilisé qu'aux frontières (validation HTTP entrante et
  schéma de sortie Gemini). Si le format des logs ou les contraintes de l'API LLM évoluent, seuls les adaptateurs
  changent.
- **Indépendance des points d'entrée ** : Le cas d'usage (`IngestMetricsUsecase`) ignore qui l'appelle. L'exposition
  choisie via API HTTP (`POST /ingestion`) facilite l'intégration dans un écosystème distribué (microservices, webhooks
  d'alerting, serveur MCP), tout en permettant d'ajouter un CLI ou un cron job directement branché sur le même Usecase.
- **Modularité des règles SRE** : Les moteurs d'analyse ne codent aucun seuil en dur ; ils consomment un contrat
  (`ThresholdsContract`) fourni par le Usecase. Une équipe SRE peut faire évoluer ces seuils ou remplacer l'adaptateur
  statique par une source dynamique (base de données, service de configuration) sans modifier la logique de détection.

## 2. Structure & Pipeline d'Exécution

```text
src/
├── core/ingestion/                 # CŒUR MÉTIER (TypeScript pur, 0 dépendance framework/SDK)
│   ├── contracts/                  # Ports secondaires (DiagnosticGateway, Thresholds)
│   ├── domain-services/            # Moteurs purs : statistiques & détection d'anomalies
│   ├── usecases/                   # Orchestration Ingestion -> Analyse -> Recommandation
│   └── value-objects/              # Modèles métier immuables (Metric, AnomalyVo, RecommendationVo)
├── adapters/
│   ├── primary/ingestion/          # Port d'entrée HTTP (IngestionController + ZodValidationPipe)
│   └── secondary/
│       ├── diagnostic/             # Adapter Mastra / Gemini + mapping ACL
│       └── thresholds/             # Implémentation des seuils SRE (StaticThresholdsService)
└── config/                         # Validation de la configuration au démarrage (Zod)
```

### Le flux en 3 étapes :

1. **Ingestion** : Validation structurelle du tableau de métriques via `ZodValidationPipe` à l'entrée du contrôleur
   HTTP, puis passage au domaine.
2. **Analyse déterministe** :
    - **Agrégation au pire état observé (*Worst-Case Status*)** : Se fier uniquement au dernier relevé masquerait une
      coupure survenue plus tôt dans la fenêtre d'analyse. Un service tombé `offline` au moins une fois sur la période
      remonte `offline` (coupure utilisateur franche, prioritaire sur `degraded`, lui-même prioritaire sur `online`).
    - **Déduplication par gravité maximale (anti-bruit)** : Lorsqu'une métrique dépasse plusieurs seuils sur un même
      timestamp (ex. un CPU à 93 % franchit à la fois les seuils `low` à 70, `medium` à 80 et `high` à 90), seule
      l'anomalie la plus haute (`high`) est émise. Traiter le niveau critique corrige de fait les paliers inférieurs, ce
      qui évite de saturer l'astreinte et le prompt LLM avec des alertes redondantes.
3. **Recommandation IA** : Corrélation des anomalies et de l'état des services par l'agent Mastra, contraint par un
   schéma *Structured Outputs* strict pour produire des actions exploitables par un système tiers.

## 3. Contraintes Techniques Résolues

- **Payload volumineux (`5mb`)** : Les 500 relevés de `rapport.json` pesant ~210 Ko (au-delà des 100 Ko par défaut
  d'Express), le body parser JSON est relevé à `5mb` dans `main.ts` pour éviter le rejet `413 Payload Too Large`.
- **Dictionnaire dynamique Gemini (`parameters`)** : L'API Structured Outputs de Gemini refusant les objets libres
  (`z.record()`) en mode strict, le schéma Zod de l'adaptateur secondaire demande une liste `{ key, value }[]` au modèle
  puis la recompose en `Record<string, unknown>` via `Object.fromEntries` avant de retourner les `RecommendationVo` au
  domaine.

## 4. Installation & Exécution

### Prérequis

- Node.js v24+
- pnpm v10+
- Clé API Google Generative AI

### Configuration

Créer un fichier `.env` à la racine du projet :

```dotenv
PORT=3000
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
DIAGNOSTIC_MODEL=google/gemini-3.8-flash
```

### Lancement et génération de `output.json`

```bash
# Installation des dépendances
pnpm install

# Démarrage du serveur NestJS
pnpm start:dev
```

Dans un second terminal, envoyer le fichier de logs sur le endpoint d'ingestion :

```bash
# Via le script pnpm (génère output.json)
pnpm ingest

# Ou directement avec curl
curl -s -S -X POST http://localhost:3000/ingestion \
  -H "Content-Type: application/json" \
  -d @rapport.json \
  -o output.json \
  -w "✅ Ingestion terminée (HTTP %{http_code} en %{time_total}s) -> output.json\n"
```

## 5. Synthèse des Résultats sur `rapport.json`

Sur les 500 relevés analysés :

- **Détection déterministe** : Extraction des pics récurrents (toutes les ~5 heures) sans perte de signal ni
  hallucination arithmétique.
- **3 recommandations SRE consolidées par cause racine** :
    1. `api_gateway` : Mise en place de *rate limiting* et d'autoscaling horizontal face aux pics à 136 connexions
       actives et 99 % de CPU.
    2. `database` : Ajustement des *healthchecks* et des *keepalive* TCP pour résorber les coupures silencieuses
       (`offline` récurrent toutes les 3h30 sans dépassement de seuil numérique).
    3. `cache` : Redimensionnement du pool de threads (pics observés à 189 threads) et politique d'éviction
       `allkeys-lru` pour contenir la dégradation de latence.

## 6. Parti pris

L'idée du test était de faire un système qui ingère des données et un LLM se devait de les restituer. Le principe étant de démontrer que il n'est pas nécessaire de sortir la grosse artillerie agentique pour élaborer une solution pertinente. 

J'ai volontairement opté pour une approche hybride pragmatique : tout le moteur d'ingestion et de détection d'anomalies est 100 % déterministe pour garantir la fiabilité, la rapidité et la testabilité de la plateforme (zéro hallucination sur les seuils). Le LLM agit comme un agent de synthèse cognitive en fin de chaîne.

Voici une formulation propre, professionnelle et percutante, idéale pour un entretien ou une note d'architecture (type ADR / Roadmap V2) :

1. **Analyse par lots priorisée** : Ingestion des anomalies de manière séquentielle, triées par sévérité décroissante (par exemple par lots de 30), afin de maîtriser la fenêtre de contexte et d'isoler finement les signaux faibles.
2. **Génération incrémentale** : Élaboration d'un premier niveau de recommandations tactiques pour chaque lot d'incidents.
3. **Agrégation et corrélation croisée** : Transmission de ces recommandations intermédiaires à un second niveau d'analyse globale pour identifier les patterns transverses et les corrélations multi-facteurs (par exemple, identifier ce qui combine la saturation CPU et les pics de latence dans différents contextes).
4. **Synthèse exécutive** : Restitution consolidée à destination des équipes cartographiant les problèmes récurrents, leurs causes racines systémiques, les plans de remédiation associés ainsi que l'impact mesuré sur l'infrastructure. »