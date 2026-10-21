# Townlet: spec, the ages

Agreed 21 October 2026 after three rounds of grilling and the research in
docs/ages.md. This is the contract for the build. Decisions here are settled.
Numbers are starting values; the balance pass may change any marked "tune", and
the change gets noted here. The first spec, the one the current game was built
to, is archived word for word at docs/archive/spec-v1.md; its sections that
survive are repeated here so this file stands alone.

## 1. What it is

A small, beautiful city builder for the browser that starts as a camp of
foragers and ends as a motor city, through seven ages. The player places every
building by hand until the Coal town, where zoning arrives as an advancement;
people arrive at the main building while there is a bed and food for them, find
their own work, and walk the paths carrying what they make. Each age has its own
resources, buildings, advancements, hazard and look. The game can be started in
any age. Three difficulty levels change how hard the world pushes back. The
look is procedural low-poly 3D in Wes Anderson palettes, with no real place,
no named civilisation and no real dates.

Not in version one: military, rivals or trade partners on the map, weather,
per-person agents, power lines or pipes, loans, multiple save slots, accounts,
any backend.

## 2. Stack

Unchanged from v1: Vite 8, TypeScript strict, Three.js 0.186 used directly;
the simulation is pure TypeScript with no DOM or Three imports, deterministic
from a seed plus the list of commands; HUD in plain DOM and CSS; ESLint,
Prettier, Vitest, Playwright; npm through the socket hook; git on `dev`;
deployment deferred. The autosave moves to version 3 and older saves are
ignored.

## 3. World

- 64 x 64 tiles. Tile kinds: water, sand, grass, forest, rock, ore. Water is
  unbuildable. Building on forest clears it. Rock outcrops are where stone is
  quarried and ore seams are where the age's metal is mined; both are placed by
  the generator in a few clusters on land and never run out.
- Generated from a seed string as in v1: seeded PRNG, simplex land mask with a
  radial falloff, one river or lake, sand at the shore, forest patches, terrace
  heights. Added: two to four rock clusters and two to three ore clusters (tune)
  away from the centre, so a settlement has to reach for them.
- Orthographic camera, four snap rotations, wheel and pinch zoom, pan by keys,
  drag, edge or touch, as today.

## 4. People

The sim counts people; it never simulates one.

- **Population** is the number of residents. Each dwelling has a capacity (its
  beds) for its age; the main building has a few. The sum is the town's beds.
- **Arrivals.** While there is a free bed and the food stock covers at least
  ten days of eating, one resident arrives at the main building every
  `arrivalDays` days (per difficulty, tune), and the arrival counter resets.
  Nothing to click. In the Motor city, zoned homes also fill, see section 10.
- **Jobs.** Every workplace has worker slots. Each day residents fill slots in
  the order of each workplace's distance from the nearest dwelling, nearest
  first, until residents run out; a workplace with no path within two tiles
  takes nobody. Unfilled slots show in the info panel as "2 of 4 workers". The
  main building employs a few as administration. Everyone else is idle at home.
- **Eating.** Every resident eats 1 food a day from the stock. When the stock
  is empty the town starves: one resident leaves every `starveDays` days
  (tune), happiness falls by 10 a day to a floor of 0, and no one arrives. A
  town that reaches zero residents is lost on normal and hard.
- **Leaving.** Below the leave threshold of happiness, one resident leaves every
  `leaveDays` days (tune) and no one arrives.
- **Walkers** are decoration, like cars today: up to 200 figures (tune) drawn
  between dwellings and workplaces along paths, each carrying the item of its
  workplace (a basket, a log, a block, an ore sack, a sheaf). They are rebuilt
  from the counts when the roads, buildings or population change; nothing in
  the sim reads them.

## 5. Resources and stock

- At most five resources are visible in an age. One arrives and one retires at
  each age change; a retired resource's stock is converted at the age-up (see
  each age) so nothing is lost silently.
- Each resource has a **stock** and a **cap**. The main building gives a base cap;
  storage buildings raise it. Production over the cap is wasted and the
  producing building says so in its panel.
- Each workplace has a **yield** per filled slot per day and may need an
  **input** per unit it makes; without input it makes nothing and says so.
- **Coin** arrives as an advancement in the Classical city and is the one
  resource with no cap. From the Coal town, buildings carry an upkeep in coin
  settled monthly as in v1; in the Motor city coin is the treasury and the
  economy of v1 applies.
- **Trade.** From the Bronze city, a trading post on the shore (a harbour from
  the Classical city) exchanges one chosen resource for another the island
  lacks at a rate of 3 to 1 (tune), up to its workers' capacity a day. There is
  no partner on the map; the ship is decoration.

## 6. Advancements

- Each age has six to eight advancements in a small tree. An advancement is
  available when its earlier advancements are held and the building it names
  is standing. It costs a stock of the age's resources, paid at once, and takes
  `researchDays` days (tune) during which the panel shows a progress bar. One
  advancement at a time.
- No hidden boosts, no discounts for deeds. The whole tree of the current age
  fits one panel; later ages are greyed with their names only.
- The last advancement of an age is the **age-up**. It needs two named
  institutions of the age standing, a stockpile, and every other advancement
  of the age except the ones marked optional. Completing it shows a title card
  (the age's name, the year count restarts), unlocks the next age's buildings
  and look, and converts the retiring resource.
- A later start (section 11) holds every advancement of the earlier ages.
- Hazards and their answers: the first time an age's hazard strikes, its
  mitigation advancement becomes visible in the tree. Until then it is hidden.
  A later start begins with the earlier ages' mitigations held.

## 7. Shared rules

- **Time.** One game day is one sim step. At 1x a day lasts 0.5 s, a 30 day
  month 15 s, a 12 month year 3 minutes. Speeds: pause, 1x, 2x, 3x. The
  calendar reads "Year 14, Bronze city" and restarts at each age-up.
- **Paths.** A building works only within two tiles (Chebyshev) of a path or
  road. The Forager age lays dirt paths for nothing; the Village age charges
  wood for them; the Classical city paves them in stone, the Coal town in
  macadam, the Motor city in tarmac, each a road type with its own look and
  the age's traffic.
- **Placement** as v1: a footprint sits entirely on grass, sand or forest with
  no road or building on it. Quarries sit on rock; mines on ore; fishing huts,
  trading posts and harbours touch water.
- **Coverage** as v1: one boolean grid per service kind, Chebyshev radius from
  any footprint tile, recomputed when buildings change.
- **Happiness** 0 to 100, recomputed daily, a weighted mean of the age's
  inputs (section 8), with weights per input in the age tables. Residents leave
  below the leave threshold.
- **Hazards.** Each age names one. Each month, with the age's chance per
  difficulty, it strikes; the mitigation halves the chance or the damage as the
  age table says. Fire keeps the v1 spread and burn rules in every age where it
  applies.
- **Every stuck thing says why.** A workplace with no workers, no input, no path
  or a full store, a dwelling with no path, and in the Motor city a lot that
  cannot grow, carries a small sign on the map and names the reason, the number
  to beat and what would fix it in the info panel. The plan for the Motor city
  half of this is in tasks/todo.md.
- **Milestones** show a title card: founding, each age-up, population at 50,
  100, 250, 500, 1000, 2500, 5000 and 10000, the first of each institution, win,
  game over.

## 8. The seven ages

Each table lists the age's main building, dwellings, workplaces, institutions,
storage, advancements, hazard, happiness inputs, traffic and look, and the
age-up. Costs are in the age's resources at normal difficulty before the cost
multiplier. Yields are per filled slot per day. Every number is tune.

Population guide per age on normal, reached before the age-up feels natural:
Forager 30, Village 150, Bronze 500, Classical 1000, Medieval 2000, Coal 3500,
Motor 5000 (the v1 win target).

### 8.1 Forager

Resources: food, wood, stone. Base caps 60 food, 40 wood, 40 stone.

| Building      | Size  | Cost            | Slots | Yield or effect                    |
| ------------- | ----- | --------------- | ----- | ---------------------------------- |
| Camp (main)   | 2 x 2 | free, first     | 2     | 6 beds, base caps, arrivals        |
| Tent          | 1     | 4 wood          |       | 3 beds                             |
| Gathering hut | 1     | 6 wood          | 2     | 2 food each, needs forest within 3 |
| Hunting hut   | 1     | 8 wood          | 2     | 3 food each, needs forest within 4 |
| Fishing hut   | 1     | 8 wood          | 2     | 3 food each, touches water         |
| Woodcutter    | 1     | 4 stone         | 2     | 2 wood each, needs forest within 3 |
| Flint pit     | 1     | 6 wood          | 2     | 2 stone each, needs rock within 3  |
| Drying rack   | 1     | 6 wood 4 stone  |       | +60 food cap                       |
| Totem         | 1     | 10 wood 6 stone |       | Institution: faith, radius 6       |

Advancements, in order of availability:

| Advancement     | Needs                                                            | Cost             | Effect                                           |
| --------------- | ---------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| Fire            | Camp                                                             | 10 wood          | Food stock decays 0 instead of 2% a day          |
| Bow             | Fire, hunting hut                                                | 15 wood 10 stone | Hunting yield 3 to 5                             |
| Nets            | Fire, fishing hut                                                | 15 wood          | Fishing yield 3 to 5                             |
| The dog         | Bow                                                              | 20 food          | Hunting hut radius 4 to 6, warns of hazard early |
| Grinding stones | Fire, gathering hut                                              | 20 stone         | Gathering yield 2 to 3, unlocks the grain store  |
| Shelter         | Nets or Bow, optional                                            | 20 wood 10 stone | Tent 3 beds to 4                                 |
| The first store | Grinding stones, totem and drying rack standing; 80 food 40 wood | the age-up       | Village                                          |

Hazard: hunger, a lean season each winter month on normal and hard: gathering
and hunting yields halve for the month. Mitigation: the drying rack (its cap
sees the town through); the dog gives a toast a month ahead.

Happiness: food store (days of eating in stock, 100 at 20 days, weight 3), food
variety (kinds of food building working, 0 to 3, weight 1), faith (share of
beds within the totem's radius, weight 1).

Traffic: walkers only. Look: tents and brush huts, a fire that glows at night,
dirt paths, the first palette's forest. Age-up card: "The Village".

### 8.2 Village

Resources: food, wood, stone, clay (the first store's grain becomes food 1 to 1;
stone cap carries; clay arrives). Base caps 150 food, 80 wood, 80 stone, 60 clay.

| Building         | Size  | Cost             | Slots | Yield or effect                                    |
| ---------------- | ----- | ---------------- | ----- | -------------------------------------------------- |
| Longhouse (main) | 2 x 2 | free at age-up   | 3     | 10 beds, base caps, arrivals                       |
| Hut              | 1     | 8 wood 4 clay    |       | 5 beds                                             |
| Field            | 2 x 2 | 6 wood           | 2     | 4 food each, on grass                              |
| Pasture          | 2 x 2 | 10 wood          | 1     | 3 food, 1 wool (counts as clay for pots and cloth) |
| Clay pit         | 1     | 8 wood           | 2     | 2 clay each, touches water or sand                 |
| Quarry           | 1     | 10 wood          | 2     | 3 stone each, on rock                              |
| Granary          | 1     | 12 wood 8 clay   |       | +200 food cap                                      |
| Store hut        | 1     | 10 wood 6 clay   |       | +80 wood and stone cap                             |
| Shrine           | 1     | 20 stone 10 clay | 1     | Institution: faith, radius 8                       |
| Well             | 1     | 15 stone         |       | Institution: water, radius 6                       |

Forager buildings persist; tents upgrade to huts in place for the hut's cost.

| Advancement    | Needs                                                              | Cost             | Effect                                           |
| -------------- | ------------------------------------------------------------------ | ---------------- | ------------------------------------------------ |
| Sowing         | Longhouse                                                          | 30 food          | Field available                                  |
| Herding        | Sowing                                                             | 30 food 20 wood  | Pasture available                                |
| Pottery        | Clay pit                                                           | 20 clay          | Granary cap +100 more; food decay 0 everywhere   |
| Weaving        | Herding, pottery                                                   | 30 clay          | Hut 5 beds to 6; happiness comfort input appears |
| Mud brick      | Clay pit, quarry                                                   | 40 clay 20 stone | Hut and longhouse cost stone instead of wood     |
| Irrigation     | Sowing, well                                                       | 40 wood 30 stone | Field yield 4 to 6 within 6 of water             |
| The first kiln | Pottery, mud brick; shrine and granary standing; 300 food 100 clay | the age-up       | Bronze city                                      |

Hazard: crop failure, a bad harvest with chance per month in the harvest
season: fields yield nothing that month. Mitigation: the granary stock; after
irrigation, irrigated fields are immune.

Happiness: food store (weight 3), food variety (weight 1), faith (shrine
coverage, weight 1), water (well coverage, weight 1), comfort after weaving
(share of beds in huts not tents, weight 1).

Traffic: walkers, and a pack dog or two. Look: round huts with thatch, fenced
fields with crop rows that change colour through the year, the longhouse with a
smoke hole, wood-edged paths. Age-up card: "The Bronze city".

### 8.3 Bronze city

Resources: food, wood, stone, bronze, clay retires (its stock becomes stone 2
to 1; brick and pots are assumed). Base caps 400 food, 150 wood, 150 stone, 60
bronze.

| Building        | Size  | Cost               | Slots | Yield or effect                                                  |
| --------------- | ----- | ------------------ | ----- | ---------------------------------------------------------------- |
| Hall (main)     | 2 x 2 | free at age-up     | 4     | 16 beds, base caps, arrivals                                     |
| Brick house     | 1     | 12 stone 6 wood    |       | 8 beds                                                           |
| Irrigated field | 2 x 2 | 8 wood 6 stone     | 2     | 7 food each, within 8 of water                                   |
| Copper mine     | 1     | 20 wood 10 stone   | 3     | 2 copper each, on ore; copper is not shown, it feeds the smelter |
| Smelter         | 1     | 30 stone 10 wood   | 2     | 1 bronze each from 2 copper and 1 tin, needs 1 wood              |
| Trading post    | 1     | 40 wood 20 stone   | 2     | Trades 3 of any stock for 1 tin a day each; touches water        |
| Warehouse       | 2 x 2 | 40 stone 20 wood   |       | +300 food, +150 wood and stone cap                               |
| Temple          | 2 x 2 | 80 stone 20 bronze | 2     | Institution: faith, radius 10                                    |
| Cistern         | 1     | 40 stone           |       | Institution: water, radius 8                                     |
| Canal           | 1     | 6 stone, dragged   |       | Counts as water for fields within 2                              |

Tin is a hidden stock bought only by trade; the smelter's panel shows it.

| Advancement        | Needs                                                               | Cost               | Effect                                              |
| ------------------ | ------------------------------------------------------------------- | ------------------ | --------------------------------------------------- |
| Smelting           | Hall, copper mine                                                   | 60 stone 40 wood   | Smelter available                                   |
| Sail               | Smelting                                                            | 40 wood            | Trading post available                              |
| The wheel          | Smelting                                                            | 30 wood 10 bronze  | Carts: every yield +1; cart traffic appears         |
| The ard            | The wheel                                                           | 20 bronze          | Field yield 7 to 9                                  |
| Writing            | Temple                                                              | 40 bronze          | Hall slots 4 to 8; arrivals every arrivalDays x 0.8 |
| Canals             | Writing                                                             | 60 stone 20 bronze | Canal available                                     |
| Levees             | Canals, after the first flood                                       | 80 stone           | Flood damage halved                                 |
| Bronze tools       | The ard, optional                                                   | 40 bronze          | Quarry and woodcutter yields +1                     |
| The first coin die | Writing, canals; temple and warehouse standing; 600 food 150 bronze | the age-up         | Classical city                                      |

Hazard: flood, chance per month in spring: fields and buildings within 2 of
water stop for a month; after levees, half of them.

Happiness: food store (3), food variety (1), faith (temple, 1), water
(cistern or canal, 1), comfort (share of beds in brick houses, 1).

Traffic: ox carts on paths after the wheel, a ship at the trading post. Look:
flat-roofed brick houses in terraces, the temple on a platform, canals as thin
water lines, stone-edged paths. Age-up card: "The Classical city".

### 8.4 Classical city

Resources: food, wood, stone, iron, coin (bronze retires; its stock becomes
iron 1 to 1). Base caps 800 food, 300 wood, 300 stone, 150 iron; coin uncapped.

| Building     | Size  | Cost              | Slots | Yield or effect                                                      |
| ------------ | ----- | ----------------- | ----- | -------------------------------------------------------------------- |
| Forum (main) | 2 x 2 | free at age-up    | 6     | 20 beds, base caps, arrivals, 2 coin a day                           |
| Insula       | 1     | 20 stone 10 wood  |       | 12 beds                                                              |
| Villa        | 2 x 2 | 60 stone 20 iron  |       | 10 beds, comfort, needs bath coverage                                |
| Iron mine    | 1     | 30 wood 20 stone  | 3     | 2 iron each, on ore, needs 1 wood                                    |
| Watermill    | 1     | 40 stone 20 iron  | 2     | Fields within 6 yield +2; touches river or lake                      |
| Bakery       | 1     | 30 stone 10 iron  | 2     | 3 food each from 2 food and 1 wood; happiness variety                |
| Market       | 2 x 2 | 60 stone 20 iron  | 3     | 3 coin each; institution: trade, radius 8                            |
| Harbour      | 2 x 2 | 80 wood 40 stone  | 4     | Trades 3 for 1 of any resource, 2 a day each                         |
| Granary      | 2 x 2 | 60 stone          |       | +600 food cap                                                        |
| Aqueduct     | 1     | 10 stone, dragged |       | Water within 2 for baths and fountains                               |
| Bath         | 2 x 2 | 100 stone 30 iron | 2     | Institution: water and health, radius 10, needs an aqueduct within 2 |
| Fire watch   | 1     | 40 stone 10 iron  | 3     | Institution: fire coverage, radius 10                                |
| Theatre      | 2 x 2 | 120 stone 40 coin | 2     | Institution: culture, radius 10                                      |

| Advancement  | Needs                                                              | Cost               | Effect                                                                  |
| ------------ | ------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------- |
| Iron working | Forum, iron mine                                                   | 80 stone 40 wood   | Iron tools: every yield +1                                              |
| Coinage      | Market                                                             | 60 iron            | Coin appears; the market pays; taxes at 1 coin per 10 residents a month |
| Paved roads  | Coinage                                                            | 100 stone 50 coin  | Stone road available; carts twice as many                               |
| Aqueducts    | Paved roads                                                        | 150 stone 50 coin  | Aqueduct, bath available                                                |
| Concrete     | Aqueducts                                                          | 100 stone 100 coin | Insula 12 beds to 16                                                    |
| Watermill    | Iron working                                                       | 80 iron            | Watermill available                                                     |
| Fire watch   | After the first fire                                               | 60 coin            | Fire watch available                                                    |
| Glass        | Concrete, optional                                                 | 80 coin            | Windows glow at night; comfort +10                                      |
| The charter  | Concrete, watermill; bath and theatre standing; 1500 food 400 coin | the age-up         | Medieval town                                                           |

Hazard: fire, v1 rules, a burning tile spreads to orthogonal neighbours; fire
watch coverage shortens the burn and the spread as the v1 fire station did.

Happiness: food store (3), variety (bakery, 1), faith (temple persists, 1),
water (bath or cistern, 1), safety (fire watch coverage, 1), culture (theatre,
1), comfort (share of beds in villas and insulae with glass, 1).

Traffic: carts on stone roads, a ship at the harbour, a sail on the lake.
Look: red tile roofs, colonnades on the forum and market, the aqueduct on
arches, paved roads with kerbs, oil lamps at night. Age-up card: "The Medieval
town".

### 8.5 Medieval town

Resources: food, wood, stone, iron, coin. Base caps 1500 food, 500 wood, 500
stone, 300 iron.

| Building         | Size  | Cost              | Slots | Yield or effect                                          |
| ---------------- | ----- | ----------------- | ----- | -------------------------------------------------------- |
| Town hall (main) | 2 x 2 | free at age-up    | 6     | 20 beds, base caps, arrivals, 4 coin a day               |
| Timber house     | 1     | 16 wood 8 stone   |       | 8 beds                                                   |
| Townhouse        | 1     | 30 stone 10 iron  |       | 12 beds, comfort                                         |
| Three-field farm | 2 x 2 | 20 wood 10 iron   | 3     | 8 food each                                              |
| Windmill         | 1     | 60 wood 20 iron   | 2     | Farms within 6 yield +2, on any grass                    |
| Sawmill          | 1     | 40 wood 20 iron   | 2     | 4 wood each, needs water within 2 and forest within 4    |
| Blast furnace    | 2 x 2 | 100 stone 40 iron | 3     | 3 iron each from ore mine output, needs 2 wood           |
| Market square    | 2 x 2 | 80 stone 40 coin  | 4     | 4 coin each; institution: trade, radius 10               |
| Guildhall        | 2 x 2 | 120 stone 60 coin | 3     | Every workshop yield +1; institution: culture, radius 10 |
| Church           | 2 x 2 | 150 stone 60 coin | 2     | Institution: faith, radius 12                            |
| Hospital         | 2 x 2 | 120 stone 80 coin | 3     | Institution: health, radius 10                           |
| Conduit          | 1     | 12 stone, dragged |       | Water within 2, replaces the aqueduct                    |
| Wall             | 1     | 20 stone, dragged |       | Decoration with a gate; comfort +5 inside                |

| Advancement    | Needs                                                                      | Cost               | Effect                                        |
| -------------- | -------------------------------------------------------------------------- | ------------------ | --------------------------------------------- |
| Heavy plough   | Town hall                                                                  | 100 iron           | Three-field farm available                    |
| Horse collar   | Heavy plough                                                               | 80 coin            | Farm yield 8 to 10; horse carts appear        |
| Windmill       | Horse collar                                                               | 120 wood 60 coin   | Windmill available                            |
| Charter market | Market square                                                              | 150 coin           | Market coin 4 to 6; taxes 2 per 10 residents  |
| Guilds         | Charter market                                                             | 200 coin           | Guildhall available                           |
| Blast furnace  | Guilds                                                                     | 150 stone 100 coin | Blast furnace available                       |
| Quarantine     | Hospital, after the first plague                                           | 200 coin           | Plague deaths halved                          |
| Printing       | Guilds, optional                                                           | 300 coin           | Research days x 0.75 for the rest of the game |
| The deep pit   | Blast furnace, windmill; church and hospital standing; 3000 food 1500 coin | the age-up         | Coal town                                     |

Hazard: plague, chance per month: for 30 days one resident in twenty leaves
(dies) and arrivals stop; hospital coverage halves it, quarantine halves it
again.

Happiness: food store (3), variety (1), faith (church, 2), water (conduit,
1), safety (fire watch persists, 1), health (hospital, 1), culture (guildhall,
1), comfort (townhouses, walls, 1).

Traffic: horse carts, a wagon on roads. Look: timber-framed houses with jettied
upper floors, the church spire, the windmill turning, cobbled roads, a wall
with a gate. Age-up card: "The Coal town".

### 8.6 Coal town

Resources: food, iron, coal, steel, coin (wood and stone retire; their stocks
become coin at 1 each; timber and masonry are assumed to be bought). Base caps
4000 food, 600 iron, 600 coal, 400 steel.

Upkeep in coin, settled monthly, begins here for every building, at the v1
scale. Taxes replace the per-resident levy: income as v1, with the tax slider.

| Building         | Size  | Cost              | Upkeep | Slots | Yield or effect                                    |
| ---------------- | ----- | ----------------- | ------ | ----- | -------------------------------------------------- |
| Town hall (main) | 2 x 2 | kept              | 0      | 8     | 20 beds, base caps, arrivals                       |
| Terrace          | 1     | 200 coin          | 2      |       | 16 beds                                            |
| Tenement         | 1     | 350 coin 20 steel | 4      |       | 30 beds                                            |
| Colliery         | 1     | 300 coin          | 20     | 4     | 3 coal each, on ore                                |
| Ironworks        | 2 x 2 | 500 coin          | 40     | 4     | 2 steel each from 2 iron and 2 coal                |
| Mill             | 2 x 2 | 400 coin 20 steel | 30     | 8     | 6 coin each, needs 1 coal; emits pollution 1       |
| Steam farm       | 2 x 2 | 300 coin 10 steel | 10     | 2     | 14 food each                                       |
| Canal            | 1     | 30 coin, dragged  | 1      |       | Water, and trade route for a barge                 |
| Railway          | 1     | 40 coin 2 steel   | 2      |       | A road type; every workplace within 2 yields +1    |
| Gasworks         | 1     | 400 coin          | 30     | 2     | Institution: light, radius 10; night glow          |
| Waterworks       | 1     | 450 coin          | 30     | 2     | Institution: water, radius 12                      |
| Sewer            | 1     | 20 coin, dragged  | 1      |       | Health within 2 after the first cholera            |
| Fire brigade     | 1     | 450 coin          | 40     | 3     | Institution: fire, radius 10 (the v1 fire station) |
| Police station   | 1     | 450 coin          | 40     | 3     | Institution: safety, radius 10                     |
| School           | 2 x 2 | 400 coin          | 40     | 3     | Institution: schooling, radius 10                  |
| Park             | 1     | 100 coin          | 5      |       | Institution: parks, radius 4                       |
| Library          | 2 x 2 | 500 coin          | 40     | 2     | Institution: culture, radius 10                    |

| Advancement     | Needs                                                                       | Cost                | Effect                                            |
| --------------- | --------------------------------------------------------------------------- | ------------------- | ------------------------------------------------- |
| Coke            | Town hall, colliery                                                         | 400 coin 100 coal   | Ironworks available                               |
| Steam engine    | Coke                                                                        | 800 coin 100 steel  | Mill, steam farm available; colliery yield 3 to 5 |
| Canals          | Steam engine                                                                | 600 coin            | Canal available                                   |
| Railway         | Canals                                                                      | 1500 coin 200 steel | Railway available; a train appears                |
| Gas light       | Steam engine                                                                | 800 coin            | Gasworks available                                |
| Public health   | Waterworks, after the first cholera                                         | 1200 coin           | Sewer available; cholera halved                   |
| Bessemer steel  | Railway                                                                     | 1500 coin 200 coal  | Ironworks yield 2 to 4; tenement available        |
| Town planning   | Public health, optional                                                     | 2000 coin           | Zoning available (section 10)                     |
| Electrification | Bessemer steel, gas light; school and library standing; 8000 coin 500 steel | the age-up          | Motor city                                        |

Hazard: cholera, chance per month: for 20 days one resident in ten within
range of a well-less dwelling leaves; waterworks coverage halves it, sewers
within 2 halve it again.

Happiness: v1 weights apply with the age's inputs: tax (2), coverage (share of
residents with water, fire, police and schooling, 2), parks (1), pollution (2),
employment (2), and food store (1).

Traffic: horse trams on roads, a train on the railway, a barge on the canal.
Look: brick terraces with chimneys, the mill with a tall stack and smoke, gas
lamps at night, macadam roads, the railway with a station. Age-up card: "The
Motor city".

### 8.7 Motor city

Resources: coin only, as the treasury; power and water are coverage. Food, iron,
coal and steel retire; their stocks become coin at 1, 2, 1 and 3 each.

This is the current game. The v1 catalogue applies: road, residential,
commercial and industrial zones, town hall (kept from the Coal town), wind
turbine, water tower, park, school, clinic, fire station, police station, tree,
plaza, bulldoze, with v1 costs, upkeep and radii. Coal town buildings persist;
the mill and colliery keep working as industry with the v1 pollution rule.

| Advancement | Needs                                               | Cost                  | Effect                                         |
| ----------- | --------------------------------------------------- | --------------------- | ---------------------------------------------- |
| The grid    | Town hall                                           | 3000 coin             | Wind turbine and water tower available         |
| The car     | The grid                                            | 4000 coin             | Tarmac road available; cars appear             |
| Zoning      | The car (or held from Coal)                         | 2000 coin             | Zones available; demand gauge appears          |
| Clinic      | Zoning                                              | 3000 coin             | Clinic available                               |
| Radio       | The grid, optional                                  | 2500 coin             | Happiness culture +10 everywhere               |
| Antibiotics | Clinic                                              | 5000 coin             | No more plague or cholera                      |
| The suburb  | Antibiotics; clinic and school standing; 20000 coin | the final advancement | Win card when the population target is reached |

Hazard: fire, v1 rules and chances.

Happiness: the v1 table.

Traffic: cars as today, buses after Zoning. Look: the current buildings, tarmac
roads with lane lines, neon windows, the v1 post-processing. Win card: "Townlet"
with the population and the years from the camp.

## 9. Age-up and the retired resource

At each age-up: the retiring resource's stock converts as the age says; the
main building is rebuilt in place as the new age's main building; the title
card shows; the calendar restarts; the new age's buildings, roads and traffic
appear in the menu and on the map. Nothing is removed.

Dwellings upgrade in place to the current age's type for the new type's cost;
the beds change at once. Workplaces of earlier ages keep working at their old
yield; the player replaces them when they want the land.

## 10. The Motor city engine

Zoning, from Town planning, works as v1 with one change: there are no demand
bars driven by jobs and workers alone. The three bars become **pressure**:
homes when arrivals are waiting for a bed (people who would arrive but cannot),
shops and industry when idle residents outnumber open slots. A zoned lot with
road, power, water and desirability over its bar builds when its pressure is
positive, by the v1 roll. Occupancy follows the v1 rules. People still arrive
at the town hall when a bed is free, so a residential zone fills from arrivals
like a placed dwelling.

Desirability, growth thresholds, pollution, tax, upkeep, debt and the v1 fire
rules apply unchanged. The stuck-lots plan in tasks/todo.md is the Motor city's
"says why" rule.

## 11. Starting in a later age

The start screen offers the age beside difficulty and palette. A later start
places the age's main building near the centre of the largest land region,
three dwellings of the age along a path, one workplace per visible resource
within reach of its deposit, water or forest, a store, and holds every earlier
advancement and mitigation, with stock at a quarter of each cap. The player
builds the rest. The Motor city start is v1's founding plus the Coal town's
town hall already standing.

## 12. Difficulty

|                               | Easy | Normal | Hard  |
| ----------------------------- | ---- | ------ | ----- |
| Starting stock, share of cap  | 0.5  | 0.25   | 0.15  |
| Cost multiplier               | 0.8  | 1.0    | 1.25  |
| Upkeep multiplier (coin ages) | 0.8  | 1.0    | 1.3   |
| Arrival days                  | 2    | 3      | 4     |
| Research days multiplier      | 0.8  | 1.0    | 1.25  |
| Leave threshold (happiness)   | 30   | 40     | 50    |
| Hazard chance multiplier      | 0    | 1.0    | 2.0   |
| Starve and leave days         | 6    | 4      | 3     |
| Debt limit (coin ages)        | none | -5000  | -2000 |
| Win target (residents)        | 2000 | 5000   | 10000 |

Easy cannot be lost: no hazards, no starvation loss, no debt limit. Winning
shows a card and the game continues. Every value here is tune.

## 13. Look

The v1 palette roles and four palette sets stay, chosen on the start screen.
Each age adds what changes between ages and nothing else:

- a building set in the age's silhouettes (section 8), built with the v1 model
  builder, wall and roof variants from the tile position;
- a road type with its own surface colour and edge;
- a traffic set: walkers in every age, then dogs, ox carts, ships, horse carts
  and wagons, trams, trains and barges, cars and buses;
- night light: a fire glow, oil lamps, gas lamps, electric windows and bloom;
- the postcard's title card names the age.

Rendering, day and night, water, post-processing, boats and birds as v1.

## 14. HUD

- Start screen: logo, age, difficulty, palette, seed, "Found the camp" (or the
  age's verb), "Continue".
- Top bar: the age's resources with stock and cap, population and beds,
  happiness, the calendar, speed buttons; pressure bars in the Motor city.
- Build menu by age: Paths, Homes, Food, Materials, Institutions, Storage,
  Bulldoze; the Motor city adds Zones. Keys 1 to 7.
- Advancements panel: the current age's tree as a list with prerequisites,
  cost, the one in progress with its bar, and the age-up at the bottom with its
  conditions ticked off as they are met.
- Info panel on click: building details, workers, input and output, stock
  effects, the sign's reason when stuck, coverage ring.
- Toasts for events, hazards and a warning a month ahead where an advancement
  grants it. Title cards for milestones and age-ups.
- Pause menu, hints (three cards per age on a new game: the age's food, its
  material, its institution), font and style as v1.

## 15. Saving

One autosave in localStorage at version 3: the serialised sim state (grids,
stocks, caps, advancements held, the age, the research in progress, hazard
state) plus camera and palette. Written monthly and after every command.

## 16. Quality bar

- Sim modules test-first with Vitest, failure modes listed before the code.
- The headless autoplayer plays every age from a fresh Forager start to the
  Motor city win on each difficulty within a bounded number of months (tune),
  never ends on easy, and plays each later start to its age-up.
- ESLint and Prettier clean. Playwright: the smoke test, the touch test, one
  spec per age that boots the age's start, builds its first workplace and sees
  its first arrival, each leaving a screenshot in `e2e/screenshots`.
- Simplify and code review every three or four code commits.

## 17. Build order

1. The people engine: beds, arrivals, slots, eating, leaving, walkers;
   resources with caps; the age and advancement state; save version 3. The
   current game keeps running on top as a Motor city with a treasury.
2. Forager age end to end: map deposits, buildings, advancements, hazard,
   look, start screen age choice, hints, e2e, autoplayer through the age.
3. Village.
4. Bronze city, with trade.
5. Classical city, with coin and roads.
6. Medieval town.
7. Coal town, with upkeep, taxes, pollution and Town planning.
8. Motor city: the v1 economy refactored onto the engine; pressure bars; the
   stuck-lots item; the final advancement and the win.
9. Balance pass with the autoplayer across all ages; README and screenshots.

Each age is playable before the next begins.

## 18. Open items, my call

- Deposit placement parameters and how many clusters per map.
- Exact walker counts, cart counts and route refresh rates.
- The hint copy per age and the title card copy.
- Model silhouettes per building, within the age's look.
