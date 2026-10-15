# Sharing and the workspace

What can come into the app, what can leave it, and which module does each step.

```mermaid
flowchart TB
  subgraph In["Coming in (Share screen: paste, drop or share link)"]
    Code["Build code<br/>B1.…"]
    Json["JSON file<br/>build · tree · workspace backup"]
    SaveUrl["ratorio save URL"]
    GistAddress["Address of a gist"]
  end

  GistAddress --> ReadGist["readGist · gist.ts<br/>fetched from GitHub, its text read in its place"] --> Recognize

  Code --> Recognize
  Json --> Recognize
  SaveUrl --> Frame1["Engine frame<br/>readSave"] --> Recognize

  Recognize["recognizeImport<br/>share-import-model.ts"] --> Preview["Preview<br/>what it is, what could not be read"]
  Preview --> Apply["applyImport"]
  Apply -->|new entry| Workspace
  Apply -->|branch of the open tree<br/>changesBetween| Workspace
  Apply -->|replace everything<br/>backup saved first| Workspace

  Workspace[("Workspace<br/>locker · characters · trees<br/>IndexedDB")]

  Locker["Locker screen<br/>edit-workspace.ts"] <--> Workspace
  Build["Build editor screen<br/>edit-workspace.ts"] <--> Workspace
  Tree["Tree · Compare · Ranking<br/>commitNodeToLocker on request"] <--> Workspace

  Workspace --> TreeOf["treeOf / characterOf<br/>inline build or tree"]
  TreeOf --> OutCode["Build code and share link<br/>encodeShareCode"]
  TreeOf --> Frame2["Engine frame<br/>writeSave"] --> OutUrl["ratorio save URL<br/>one build, no tree"]
  Workspace --> OutJson["JSON backup<br/>the whole workspace"]
```

- **One recognizer for every way in.** Paste, file drop, file picker and a share link all hand a text to `recognizeImport`, which decides what it is and never changes anything. Only `applyImport` writes, and only after the preview.
- **A share link keeps the code in the URL fragment.** The fragment is not sent to the server that hosts the app; the app reads it once and removes it from the address.
- **ratorio saves go through the engine frame both ways**, because reading and writing them uses upstream's own save classes. Reading reports what it could not carry over (`notImported`); writing reports what the save has no place for (`notExported`).
- **A branch from an import** is the list of changes that turns the open tree's root into the imported character (`changesBetween`). Differences a change cannot express (job, levels, timed items, speed potion) are reported, not dropped silently.
- **Loadouts live in the workspace too.** A gear loadout points at locker pieces by slot, a stat loadout holds base and trait stats. Either can be put on a character or turned into the changes of a tree branch, which is how two loadouts are compared.
- **Locker edits reach everyone who uses the piece.** A piece is stored once; characters and tree nodes point at it by ID, so removing a piece that is still used is refused.
