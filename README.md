# 📘 xcraft-core-shredder

## Aperçu

`xcraft-core-shredder` est une bibliothèque utilitaire du framework Xcraft qui encapsule [immutable](Immutable.js) derrière une API simplifiée, orientée « chemins » (paths), pour manipuler des états immutables. Elle sert de couche d'abstraction commune utilisée par les acteurs Goblin/Elf pour représenter et faire muter leur état (`ActorState`), ainsi que par les widgets React pour lire des données de manière prévisible et performante. Le module fournit également les mécanismes d'application de patches réseau (synchronisation Warehouse v4/v5) et de changements de type CRUD (changefeed), utilisés pour propager les mutations d'état entre le backend et les clients.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Détails des sources](#détails-des-sources)
- [Licence](#licence)

## Structure du module

Le module expose une seule classe principale, `Shredder` (fichier `lib/shredder.js`, point d'entrée `main` du `package.json`), épaulée par trois fichiers utilitaires :

- **`lib/shredder.js`** — la classe `Shredder` elle-même : constructeur, accesseurs, méthodes de lecture/écriture par chemin, méthodes de type « collection » (map, filter, sort, etc.), gestion du logging et méthodes statiques utilitaires.
- **`lib/apply-patches.js`** — fonction `applyPatches`, attachée statiquement à `Shredder.applyPatches`, qui réconcilie un état local avec un état distant reçu sous forme de patches (Warehouse v4 ou v5).
- **`lib/apply-changes.js`** — fonction utilitaire utilisée par `Shredder.prototype.applyChange` pour appliquer, sur un tableau brut, des changements de type changefeed (`add`, `remove`, `change`, `state`, `initial`, `uninitial`).
- **`lib/pluck-path.js`** — fonction récursive `pluckPath`, utilisée par `Shredder.pluck`, qui extrait une sous-vue d'un état selon une sélection de chemins (éventuellement imbriqués).

Le fichier `test/shredder.spec.js` contient la suite de tests (Mocha/Chai) couvrant les opérations `set`, `del` et `find`, ainsi que des bancs de performance désactivés (`describe.skip`) pour comparer différentes stratégies de mutation en masse.

## Fonctionnement global

Chaque instance de `Shredder` encapsule un état Immutable.js (`Map`, `List`, etc.) accessible via la propriété `state`. Le constructeur accepte :

- un autre `Shredder` (l'état interne est alors partagé par référence) ;
- une structure déjà immutable (utilisée telle quelle) ;
- une valeur JS brute (objet, tableau, primitive), convertie via `fromJS`.

Toutes les méthodes de mutation (`set`, `del`, `push`, `merge`, `filter`, `map`, etc.) sont **pures** : elles ne modifient jamais l'instance courante mais retournent un nouveau `Shredder` cloné (`_clone()`), qui conserve les réglages de logging (`_useLogger`, `_logger`). L'état interne, lui, reste partagé structurellement grâce à Immutable.js (copie sur écriture, sans duplication complète).

### Résolution des chemins (paths)

La plupart des méthodes acceptent un chemin sous forme de chaîne, qui est transformé en tableau de segments par `Shredder._toPath` :

- notation pointée : `"user.profile.name"` → `['user', 'profile', 'name']` ;
- notation avec crochets pour les indices : `"items[0].title"` → `['items', 0, 'title']` ;
- chemins mixtes : `"users[0].addresses.home.street"`.

Les chemins déjà parsés sont mis en cache dans une `Map` globale (module-level, partagée entre toutes les instances) limitée à **4096 entrées** ; au-delà, l'entrée la plus ancienne est évincée. Un chemin fourni directement sous forme de tableau (`Array.isArray(path) === true`) contourne ce parsing.

Par sécurité, `_protectShredderTools` interdit qu'un chemin commence littéralement par le segment `set` ou `get`, afin d'éviter d'écraser accidentellement les méthodes du Shredder via un chemin racine mal formé.

Lors d'un `set`, `_setListFromPath` s'assure que chaque segment numérique du chemin correspond bien à une structure indexée (`List`) ; sinon, une liste vide est créée à cet emplacement avant l'écriture finale (`setIn`).

### Journalisation (logging)

Un `Shredder` peut recevoir un logger via `attachLogger(logger)`, puis activer la journalisation avec `enableLogger()`. Tant que `useLogger` est `false` (valeur par défaut), l'accesseur `log` retourne un logger « no-op » (toutes les méthodes `verb`/`info`/`warn`/`err` sont vides), sauf `dbg` qui reste relié au logger réel si présent, ou à `console.log` sinon. Une fois activé, chaque opération de mutation (`set`, `del`, `map`, `filter`, `mapKeys`, `deleteAll`, `last`, `first`, `includes`) journalise l'état résultant via `_stateView`, qui sérialise l'état en JSON en masquant les références circulaires de type `parent` (remplacées par leur `id`).

### Synchronisation d'état (patches et changements)

Deux mécanismes distincts permettent de faire évoluer un état à partir de données externes :

1. **`Shredder.applyPatches(currentState, prevState, remoteState)`** — utilisé pour appliquer les patches reçus du Warehouse (le magasin d'état central de Xcraft). Si `remoteState.patches` est absent, le format est considéré comme du **Warehouse v4** et le patch est appliqué directement via `xcraft-immutablepatch`. S'il est présent, le format est **Warehouse v5** : chaque branche de `remoteState.patches` est traitée indépendamment — une valeur à `false` supprime la branche de l'état courant, sinon le patch de la branche est appliqué à l'état précédent de cette branche (ou à un objet vide par défaut).
2. **`Shredder.prototype.applyChange(path, change)`** — utilisé pour appliquer un changement unitaire de type changefeed (à la manière de RethinkDB) sur la collection présente au chemin donné. Le changement est délégué à `apply-changes.js`, qui manipule un tableau JS brut (obtenu via `.valueSeq().toArray()`) puis réécrit le résultat au même chemin avec `set`.

## Exemples d'utilisation

### Création et accès à l'état

```javascript
const Shredder = require('xcraft-core-shredder');

const state = new Shredder({
  users: {
    user1: {name: 'Alice', age: 30},
    user2: {name: 'Bob', age: 25},
  },
});

const userName = state.get('users.user1.name'); // 'Alice'
const userAge = state.get('users.user1.age', 0); // 30 (valeur de repli si absent)

// Toute mutation retourne un nouveau Shredder, l'original reste inchangé
const olderAlice = state.set('users.user1.age', 31);
const withoutBob = state.del('users.user2');
```

### Manipulation de listes

```javascript
let listState = new Shredder({items: []});
listState = listState.push('items', {id: 1, name: 'Item 1'});
listState = listState.push('items', {id: 2, name: 'Item 2'});

// Retire un élément précis (comparaison par égalité/valeur)
listState = listState.unpush('items', {id: 1, name: 'Item 1'});

// Réordonne un élément avant un autre
listState = listState.move('items', item2, item1);
```

### Mutations groupées avec `withMutations`

```javascript
const initial = new Shredder({count: 0, items: []});

const updated = initial.withMutations((mutable) => {
  mutable.set('count', 3);
  mutable.push('items', 'a');
  mutable.push('items', 'b');
});
```

### Utilisation dans la logique d'un acteur Goblin

`Shredder` est le type d'état par défaut manipulé dans les handlers de logique d'un acteur **Goblin** (legacy) :

```javascript
const logicHandlers = {
  'create': (state, action) => state.set('', {users: {}, currentUser: null}),

  'add-user': (state, action) => {
    const userId = action.get('userId');
    const userData = action.get('userData');
    return state.set(`users.${userId}`, userData);
  },
};
```

### Extraction ciblée avec `pluck`

```javascript
// state est ici une Map Immutable.js (pas un Shredder)
const view = Shredder.pluck(state, ['name', {profile: ['email', 'avatar']}]);
// => { name: '...', profile: { email: '...', avatar: '...' } }
```

## Interactions avec d'autres modules

- **[xcraft-core-goblin]** — utilise `Shredder` comme représentation par défaut de l'état (`ActorState`) des acteurs Goblin et Elf ; les quêtes et le code de logique manipulent l'état via l'API de chemins de `Shredder`.
- **[goblin-laboratory]** — les widgets React de l'écosystème Xcraft reçoivent leurs props sous forme d'instances `Shredder` et s'appuient sur ses méthodes (`get`, `map`, `equals`, etc.) pour un rendu efficace.
- **xcraft-immutablepatch** — consommé par `apply-patches.js` pour appliquer les patches d'état issus du Warehouse (format v4).
- **Warehouse (xcraft-core-goblin)** — `Shredder.applyPatches` est le point d'entrée utilisé côté client pour reconstituer l'état à partir des patches diffusés par le Warehouse, qu'il s'agisse de l'ancien format (v4, patch global) ou du nouveau (v5, patches par branche).

## Détails des sources

### `shredder.js`

Définit la classe `Shredder`, seul export du module. Le constructeur `new Shredder(initialState, key)` normalise n'importe quelle entrée (autre `Shredder`, structure Immutable.js ou valeur JS brute) vers un état Immutable.js interne. Le paramètre `key` est optionnel et simplement exposé via l'accesseur `key`.

#### Modèle de données interne

L'état d'un `Shredder` n'a pas de forme imposée : il reflète directement la structure JS/Immutable.js qui lui a été fournie à la construction ou lors des mutations successives (`Map` pour les objets, `List` pour les tableaux). Les métadonnées internes de l'instance sont :

- `_state` : l'état Immutable.js courant ;
- `_key` : identifiant optionnel de l'instance ;
- `_useLogger` / `_logger` : configuration du logging ;
- `_isSuperReaper6000` : marqueur interne (toujours `true`) permettant à `Shredder.isShredder` de reconnaître une instance sans dépendre de `instanceof` (utile entre réalms/contextes différents).

#### Méthodes publiques

- **`get(path, fallbackValue=undefined)`** — Récupère la valeur au chemin donné ; si le résultat est une structure immutable, il est réencapsulé dans un nouveau `Shredder`, sinon la valeur primitive est retournée telle quelle. `fallbackValue` est converti via `fromJS` s'il est fourni.
- **`set(path, value)`** — Définit une valeur au chemin donné, en créant au besoin les listes intermédiaires nécessaires ; lève une erreur si `path` est vide et que `value` n'est pas un objet.
- **`del(path)` / `delete(path)`** — Supprime la valeur au chemin donné (`delete` est un simple alias de `del`).
- **`deleteAll(...args)`** — Supprime plusieurs chemins en une seule opération (proxy vers `Collection.deleteAll` d'Immutable.js).
- **`has(path)`** — Indique si une valeur existe au chemin donné.
- **`pick(...keys)`** — Retourne un objet JS ne contenant que les clés de premier niveau demandées.
- **`merge(path, value)` / `mergeDeep(path, value)`** — Fusionne (superficiellement ou récursivement) `value` avec le nœud existant au chemin donné.
- **`push(path, value)` / `pop(path)`** — Ajoute/retire un élément en fin de liste au chemin donné.
- **`unpush(path, value)`** — Retire de la liste le premier élément égal à `value` ; ne fait rien si le chemin n'existe pas.
- **`concat(path, value)`** — Concatène une liste (ou un `Shredder`) à la liste existante au chemin donné.
- **`clear(path)`** — Vide la liste au chemin donné.
- **`move(path, value, beforeValue)`** — Déplace `value` juste avant `beforeValue` dans la liste ; si `beforeValue` est introuvable, l'élément est déplacé en fin de liste.
- **`applyChange(path, change)`** — Applique un changement de type changefeed (`add`/`remove`/`change`/`state`/`initial`/`uninitial`) sur la liste présente au chemin donné.
- **`map`, `mapKeys`, `mapEntries`, `filter`, `sort`, `sortBy`, `reverse`, `slice`, `splice`, `last`, `first`** — Proxys vers les méthodes équivalentes d'Immutable.js ; celles qui retournent une structure sont réencapsulées dans un nouveau `Shredder`.
- **`find(...args)`** — Retourne le premier élément correspondant : un nouveau `Shredder` si le résultat est une structure immutable, la valeur brute sinon, ou `null` si rien n'est trouvé.
- **`forEach`, `reduce`, `every`, `some`, `includes`, `indexOf`, `count`, `isEmpty`, `join`, `hashCode`** — Proxys directs vers les méthodes Immutable.js correspondantes, sans réencapsulation.
- **`transform(kSelector, vSelector)`** — Construit un objet JS plain à partir de la collection, où `kSelector(index, valeur)` fournit la clé et `vSelector(index, valeur)` la valeur de chaque entrée.
- **`select(selector)`** — Transforme la collection en tableau JS via `selector(index, valeur)`.
- **`objectAt(index)` / `keyAt(index)`** — Retournent respectivement l'entrée (sous forme d'objet à une clé) et la clé se trouvant à l'index donné.
- **`toKeyedSeq`, `keySeq`, `valueSeq`, `entrySeq`, `keys`, `values`, `entries`, `getIn`** — Accès en lecture seule sous forme de séquences/itérateurs Immutable.js, sans conversion.
- **`toJS`, `toArray`, `toObject`, `toList`, `toSeq`** — Conversions de l'état courant vers différentes représentations.
- **`equals(other)`** — Compare l'état courant avec un autre `Shredder` ou une structure Immutable.js.
- **`withMutations(mutator)`** — Exécute `mutator` sur un `Shredder` temporaire dont l'état est mutable (batch de modifications), puis retourne un nouveau `Shredder` figé avec le résultat.
- **`attachLogger(logger)` / `detachLogger()` / `enableLogger()` / `disableLogger()`** — Gestion du logger optionnel attaché à l'instance.
- **`toString()`** — Sérialise l'état via `_stateView` (méthode surtout utile en débogage/inspection).
- **`[Symbol.iterator]()`** — Rend l'instance itérable directement (délègue à l'itérateur de l'état Immutable.js), permettant d'utiliser `for...of` sur un `Shredder`.

#### Méthodes statiques

- **`Shredder.isShredder(value)`** — Détecte si `value` est une instance de `Shredder` via le marqueur interne `_isSuperReaper6000`.
- **`Shredder.isImmutable(value)`** — Proxy vers `isImmutable` d'Immutable.js.
- **`Shredder.isList(value)`** — Détecte si une valeur (Shredder ou brute) représente une `List` Immutable.js.
- **`Shredder.toImmutable(value)`** — Convertit n'importe quelle valeur (Shredder, brute ou déjà immutable) vers une structure Immutable.js.
- **`Shredder.pluck(state, view)`** — Extrait une sous-vue d'un état Immutable.js selon un tableau de chemins simples ou d'objets de sélection imbriqués (délègue aux cas imbriqués à `pluckPath`).
- **`Shredder.withKeyPredicate(...keys)`** — Construit un prédicat `(valeur, clé) => boolean` utilisable avec `filter`, vrai si la clé fait partie de `keys`.
- **`Shredder.mutableReducer(mutator)`** — Fabrique un reducer de type Redux qui applique `mutator` dans un contexte `withMutations` d'Immutable.js (optimisation pour les reducers de logique Goblin).
- **`Shredder.fromJS(...args)`** — Proxy direct vers `fromJS` d'Immutable.js.
- **`Shredder.applyPatches`** — Référence directe vers la fonction exportée par `apply-patches.js` (voir plus bas).

### `apply-patches.js`

Expose la fonction `applyPatches(currentState, prevState, remoteState)`, assignée à `Shredder.applyPatches`. Elle réconcilie un état local avec les patches envoyés par le Warehouse Xcraft, en gérant deux formats :

- **Warehouse v4** : `remoteState.state` contient un patch global unique, appliqué via `xcraft-immutablepatch` sur `prevState`.
- **Warehouse v5** : `remoteState.patches` contient un patch par branche d'état. Pour chaque branche, une valeur `false` supprime la branche (`state.delete(branch)`) ; sinon le patch est appliqué à l'état précédent de cette branche (`prevState.get(branch)`, ou `fromJS({})` si absent), et le résultat est réinjecté dans l'état courant via `withMutations` pour limiter les recopies intermédiaires.

### `apply-changes.js`

Fonction utilitaire (non attachée directement à `Shredder`, utilisée en interne par `applyChange`) qui applique un changement de type changefeed sur un tableau JS brut, en s'inspirant du format de changefeed RethinkDB :

- **`add` / `initial`** — insère `change.new_val` à `change.new_offset` si fourni, sinon en fin de tableau.
- **`remove` / `uninitial`** — retire l'élément à `change.old_offset`, ou recherche par égalité profonde (`deep-equal`) de `id` si l'offset est absent ; lève une erreur de programmation si l'élément est introuvable.
- **`change`** — retire l'ancien élément (par offset ou par recherche d'`id`) et insère le nouveau à la position indiquée.
- **`state`** — cas initial sans émission encore reçue : le tableau reste inchangé.
- Tout autre type de changement provoque une erreur explicite (`unrecognized 'type' field`).

### `pluck-path.js`

Fournit la fonction récursive `pluckPath(obj, state, selection, prevPath)`, utilisée par `Shredder.pluck` pour construire un objet JS de sortie à partir d'un état Immutable.js et d'une sélection de chemins pouvant être imbriqués. La sélection accepte trois formes :

- une clé associée à `true` → extrait la valeur au chemin correspondant ;
- une clé associée à un tableau de propriétés → extrait chacune des sous-propriétés (`{profile: ['name', 'email']}`) ;
- une clé associée à un autre objet de sélection → récursion pour construire un chemin plus profond.

La fonction interne `setAtPath` reconstruit la hiérarchie de l'objet de sortie segment par segment, en créant les objets intermédiaires manquants.

## Licence

Ce module est distribué sous [licence MIT](./LICENSE).

---

_Ce contenu a été généré par IA_

[goblin-laboratory]: https://github.com/Xcraft-Inc/goblin-laboratory
[xcraft-core-goblin]: https://github.com/Xcraft-Inc/xcraft-core-goblin
[xcraft-immutablepatch]: https://github.com/Xcraft-Inc/immutable-js-patch
