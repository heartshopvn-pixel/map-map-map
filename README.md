# ⚔️ Aethelgard RTS — Isometric Empire & Siege Simulation

**Aethelgard RTS** is a lightweight 2D isometric real-time strategy (RTS) and empire-building sandbox written in TypeScript and HTML5 Canvas. Players gather resources, construct fortified citadels, research siege technologies, and command tactical formations across procedurally generated frontier maps.

---

## 🏰 Core Mechanics & Systems

- **Resource Economy & Supply Lines**:
  - Four primary resources (**Timber**, **Quarried Stone**, **Iron Ore**, and **Imperial Gold**) harvested by villager units with automated drop-off routing to Town Centers and Storehouses.
  - Dynamic upkeep and supply cap calculated from active garrisons, watchtowers, and siege workshops.
- **Four-Age Imperial Tech Tree**:
  - **Frontier Age** ➔ **Feudal Principality** ➔ **Fortified Citadel Age** ➔ **Imperial Siege Era**.
  - Unlockable unit classes: *Militia Halberdiers*, *Longbowmen*, *Cataphract Cavalry*, and *Counterweight Trebuchets*.
- **Tactical Pathfinding & Formation AI**:
  - Grid-based hierarchical `A*` pathfinding with local collision avoidance and steering behaviors.
  - Line, wedge, and box formations with elevation-based ranged damage modifiers and fog-of-war line-of-sight (LoS) raycasting.
- **Skirmish AI Personalities**:
  - Configurable AI commanders (*Turtle Builder*, *Feudal Rush*, *Balanced Boom*) operating on deterministic tick intervals.

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development sandbox
npm run dev

# Build static bundle
npm run build
```

---

## 📂 Architecture Overview

| Module | Description |
| :--- | :--- |
| `src/config` | Unit stats, building footprints, tech-tree costs, and map seeds |
| `src/hooks` | Deterministic simulation loop, formation movement, and combat resolver |
| `src/components` | Isometric viewport renderer, minimap radar, and command card HUD |
| `src/services` | WebAudio procedural sound effects and local save-state serialization |
