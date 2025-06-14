# 📘 Documentation du module xcraft-core-shredder

## Aperçu

Le module `xcraft-core-shredder` est une couche d'abstraction autour de la bibliothèque **Immutable.js** qui fournit une API simplifiée et cohérente pour la gestion d'état immutable dans l'écosystème Xcraft. Il agit comme un wrapper intelligent qui facilite la manipulation de structures de données complexes tout en préservant l'immutabilité.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Détails des sources](#détails-des-sources)

## Structure du module

Le module est organisé autour de plusieurs composants clés :

- **Classe Shredder** : L'interface principale qui encapsule un état Immutable.js
- **Utilitaires de patches** : Fonctions pour appliquer des modifications d'état
- **Gestionnaire de changements** : Logique pour traiter les modifications de collections
- **Optimisations de performance** : Cache pour les chemins d'accès et méthodes optimisées

## Fonctionnement global

Le Shredder fonctionne comme une couche d'abstraction qui :

1. **Encapsule l'état immutable** : Chaque instance Shredder contient un état Immutable.js interne
2. **Simplifie l'accès aux données** : Utilise des chemins de type string (`"user.profile.name"`) au lieu de la syntaxe Immutable.js
3. **Optimise les performances** : Met en cache les chemins parsés et fournit des méthodes de mutation optimisées
4. **Gère les collections** : Fournit des méthodes spécialisées pour manipuler des listes et des objets
5. **Supporte le logging** : Intègre un système de logging optionnel pour le débogage

### Gestion des chemins

Le système de chemins supporte plusieurs syntaxes :

- **Notation pointée** : `"user.profile.name"`
- **Notation avec crochets** : `"items[0].title"`
- **Chemins mixtes** : `"users[0].addresses.home.street"`

### Cache de performance

Un cache global limite à 4096 entrées stocke les chemins parsés pour éviter le re-parsing répétitif des mêmes chemins d'accès.

## Exemples d'utilisation

### Création et manipulation basique

```javascript
const Shredder = require('xcraft-core-shredder');

// Création d'un shredder
const state = new Shredder({
  users: {
    user1: {name: 'Alice', age: 30},
    user2: {name: 'Bob', age: 25},
  },
});

// Lecture de données
const userName = state.get('users.user1.name'); // 'Alice'
const userAge = state.get('users.user1.age', 0); // 30 (avec fallback)

// Modification de données (retourne un nouveau shredder)
const newState = state.set('users.user1.age', 31);

// Suppression de données
const stateWithoutUser = state.del('users.user2');
```

### Manipulation de collections

```javascript
// Ajout d'éléments à une liste
let listState = new Shredder({items: []});
listState = listState.push('items', {id: 1, name: 'Item 1'});
listState = listState.push('items', {id: 2, name: 'Item 2'});

// Suppression d'un élément spécifique
listState = listState.unpush('items', {id: 1, name: 'Item 1'});

// Déplacement d'éléments
listState = listState.move('items', item1, item2);

// Fusion d'objets
const merged = state.merge('users.user1', {email: 'alice@example.com'});
```

### Utilisation dans un acteur Goblin

```javascript
const logicHandlers = {
  'create': (state, action) => {
    return state.set('', {
      users: {},
      currentUser: null,
    });
  },

  'add-user': (state, action) => {
    const userId = action.get('userId');
    const userData = action.get('userData');
    return state.set(`users.${userId}`, userData);
  },

  'update-user-name': (state, action) => {
    const userId = action.get('userId');
    const newName = action.get('name');
    return state.set(`users.${userId}.name`, newName);
  },
};
```

### Utilisation avec logging

```javascript
const state = new Shredder(initialData);
state.attachLogger(logger);
state.enableLogger();

// Les opérations seront maintenant loggées
const newState = state.set('user.name', 'Alice');
// Log: "next state after set user,name: {...}"
```

### Utilisation des méthodes statiques

```javascript
// Vérification de type
if (Shredder.isShredder(value)) {
  console.log("C'est un Shredder");
}

// Conversion vers immutable
const immutableData = Shredder.toImmutable(plainObject);

// Extraction de données avec pluck
const view = Shredder.pluck(state, ['user.name', 'user.email']);

// Création de prédicats pour filtrage
const keyPredicate = Shredder.withKeyPredicate('name', 'email');
const filtered = state.filter(keyPredicate);
```

## Interactions avec d'autres modules

Le module `xcraft-core-shredder` est central dans l'écosystème Xcraft :

- **[xcraft-core-goblin]** : Utilise Shredder comme gestionnaire d'état par défaut pour tous les acteurs Goblin
- **[goblin-laboratory]** : Les widgets React reçoivent des données via des instances Shredder
- **[xcraft-immutablepatch]** : Utilisé pour appliquer des patches d'état de manière optimisée
- **Warehouse v4/v5** : Supporte les deux versions du système de persistance avec gestion des patches

## Détails des sources

### `shredder.js`

La classe principale qui encapsule toute la logique de manipulation d'état immutable. Elle fournit une API fluide pour :

- **Gestion d'état** : Création, lecture, écriture et suppression de données
- **Manipulation de collections** : Méthodes spécialisées pour les listes et objets
- **Performance** : Cache des chemins et optimisations pour les mutations en lot
- **Debugging** : Système de logging intégré et méthodes d'inspection

#### État et modèle de données

L'état interne est toujours une structure Immutable.js (`Map`, `List`, etc.) accessible via la propriété `state`. Le Shredder maintient également :

- `_key` : Identifiant optionnel de l'instance
- `_useLogger` : Flag pour activer/désactiver le logging
- `_logger` : Instance du logger attaché

#### Méthodes publiques

- **`set(path, value)`** — Définit une valeur à un chemin donné, retourne un nouveau Shredder
- **`get(path, fallbackValue)`** — Récupère une valeur à un chemin donné, avec valeur de fallback optionnelle
- **`del(path)` / `delete(path)`** — Supprime une valeur à un chemin donné
- **`has(path)`** — Vérifie l'existence d'une valeur à un chemin donné
- **`merge(path, value)`** — Fusionne un objet avec la valeur existante à un chemin
- **`mergeDeep(path, value)`** — Fusionne récursivement un objet avec la valeur existante
- **`push(path, value)`** — Ajoute un élément à la fin d'une liste
- **`pop(path)`** — Supprime le dernier élément d'une liste
- **`unpush(path, value)`** — Supprime un élément spécifique d'une liste
- **`concat(path, value)`** — Concatène une liste ou valeur à une liste existante
- **`move(path, value, beforeValue)`** — Déplace un élément dans une liste
- **`clear(path)`** — Vide une liste
- **`map(callback)`** — Applique une fonction à chaque élément et retourne un nouveau Shredder
- **`filter(callback)`** — Filtre les éléments selon un prédicat
- **`find(callback)`** — Trouve le premier élément correspondant au prédicat
- **`sort(compareFn)` / `sortBy(keyFn)`** — Trie les éléments selon une fonction de comparaison ou une clé
- **`reverse()`** — Inverse l'ordre des éléments
- **`slice(begin, end)`** — Extrait une portion de la collection
- **`splice(index, removeNum, ...values)`** — Modifie une liste en supprimant/ajoutant des éléments
- **`withMutations(mutator)`** — Permet des mutations en lot optimisées
- **`pick(...keys)`** — Extrait uniquement les clés spécifiées
- **`applyChange(path, change)`** — Applique un changement de type CRUD à une collection
- **`transform(keySelector, valueSelector)`** — Transforme la collection en objet avec sélecteurs personnalisés
- **`select(selector)`** — Sélectionne et transforme les éléments en tableau

#### Méthodes utilitaires

- **`toJS()`** — Convertit vers un objet JavaScript plain
- **`toArray()` / `toList()` / `toObject()`** — Conversions vers différents types
- **`isEmpty()` / `size` / `length`** — Informations sur la taille
- **`equals(other)`** — Comparaison d'égalité avec un autre Shredder ou structure immutable
- **`includes(value)`** — Vérifie la présence d'une valeur
- **`attachLogger(logger)` / `detachLogger()`** — Gestion du logger
- **`enableLogger()` / `disableLogger()`** — Activation/désactivation du logging

#### Méthodes statiques

- **`isShredder(value)`** — Vérifie si une valeur est un Shredder
- **`isImmutable(value)`** — Vérifie si une valeur est immutable
- **`isList(value)`** — Vérifie si une valeur est une liste
- **`toImmutable(value)`** — Convertit une valeur vers une structure immutable
- **`pluck(state, view)`** — Extrait des données selon une vue définie
- **`withKeyPredicate(...keys)`** — Crée un prédicat pour filtrer par clés
- **`mutableReducer(mutator)`** — Crée un reducer optimisé pour les mutations
- **`fromJS(...args)`** — Proxy vers Immutable.fromJS

### `apply-patches.js`

Gère l'application de patches d'état pour la synchronisation avec le système Warehouse. Supporte deux versions :

- **Warehouse v4** : Patches simples appliqués directement
- **Warehouse v5** : Patches par branche avec gestion des suppressions

La fonction principale `applyPatches(currentState, prevState, remoteState)` applique intelligemment les modifications selon le format détecté.

### `apply-changes.js`

Utilitaire pour appliquer des changements de type CRUD sur des collections. Gère les types de changements :

- **`add`/`initial`** : Ajout de nouveaux éléments
- **`remove`/`uninitial`** : Suppression d'éléments existants
- **`change`** : Modification d'éléments existants
- **`state`** : Réinitialisation de l'état

Utilise `deep-equal` pour comparer les identifiants et gérer les positions dans les collections ordonnées.

### `pluck-path.js`

Fonction utilitaire pour extraire des sous-ensembles de données selon une sélection définie. Permet de créer des vues partielles de l'état en spécifiant :

- **Propriétés simples** : `{ user: true }`
- **Propriétés multiples** : `{ user: ['name', 'email'] }`
- **Structures imbriquées** : `{ user: { profile: ['name', 'avatar'] } }`

La fonction `setAtPath` permet de construire récursivement l'objet de sortie en suivant les chemins spécifiés.

---

_Ce document a été mis à jour pour refléter l'état actuel du code source._

[xcraft-core-goblin]: https://github.com/Xcraft-Inc/xcraft-core-goblin
[goblin-laboratory]: https://github.com/Xcraft-Inc/goblin-laboratory
[xcraft-immutablepatch]: https://github.com/Xcraft-Inc/immutable-js-patch