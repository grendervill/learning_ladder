# LÖVE 2D: аркада

## 🎯 Цель
Собрать настоящую мини-игру: понять, зачем нужен `dt`, как ловить столкновения
прямоугольников, как устроены состояния игры и спрайты, куда подключается звук. К
концу урока у тебя будет маленькая аркада с игроком, целью и счётом.

## 📖 Теория

### 1. Вспомним каркас
Игра на LÖVE — это три функции, которые вызывает движок:

```lua
function love.load() end     -- один раз: начальные значения
function love.update(dt) end -- каждый кадр: логика
function love.draw() end     -- каждый кадр: рисование
```

> **Браузерный предпросмотр** в заданиях поддерживает **подмножество API**:
> `love.load`, `love.update`, `love.draw`, `love.graphics.setColor`, `clear`,
> `rectangle`, `circle`, `line`, `print`, `polygon`, `love.timer.getDelta`,
> `love.keypressed` и `love.mousepressed`. Спрайты (`love.graphics.newImage`) и
> звук (`love.audio`) в предпросмотре **не работают** — для них нужен настоящий
> движок с **love2d.org** (запуск папки игры командой `love .`).

### 2. Delta time — сердце плавного движения
Мы уже знаем: скорость умножаем на `dt`. Разберём подробнее, почему.

`dt` (delta time) — сколько **секунд** прошло с прошлого кадра. При 60 кадрах в
секунду `dt ≈ 0.016`. Если объект движется со скоростью `200` пикселей в секунду, то:

```lua
x = x + speed * dt   -- за кадр прибавится 200 * 0.016 ≈ 3.3 пикселя
```

За секунду наберётся ровно `200` пикселей — независимо от того, 30 у тебя кадров или
120. Это и есть кадронезависимость.

Полезные правила:
- **Позицию** меняем на `скорость * dt`.
- **Скорость** меняем на `ускорение * dt`.
- Всё, что «за секунду», умножаем на `dt`.

```lua
function love.update(dt)
  x = x + vx * dt      -- позиция по скорости
  vy = vy + 900 * dt   -- гравитация: ускорение 900 пикс/сек²
  y = y + vy * dt
end
```

Слишком большой `dt` (например, после паузы) может «протащить» объект сквозь стену.
Поэтому в предпросмотре `dt` ограничен сверху, а в реальных играх его иногда
разбивают на несколько маленьких шагов — но для нашей аркады это не понадобится.

### 3. Столкновения: AABB по прямоугольникам
Самый простой и самый частый способ ловить касания — **AABB** (axis-aligned
bounding box): считаем каждый объект прямоугольником и проверяем, пересекаются ли
они. Никаких углов и поворотов — только «рамки».

У прямоугольника есть `x, y` (левый верхний угол), `w` и `h`. Два прямоугольника
пересекаются, если **перекрываются по обеим осям**:

```lua
local function hit(ax, ay, aw, ah, bx, by, bw, bh)
  return ax < bx + bw and bx < ax + aw and
         ay < by + bh and by < ay + ah
end
```

Читается так: «левый край A левее правого края B, **и** левый край B левее правого
края A, **и** то же самое по вертикали». Если все четыре условия верны — рамки
пересеклись.

```lua
function love.update(dt)
  player.x = player.x + player.vx * dt
  if hit(player.x, player.y, player.w, player.h,
         coin.x, coin.y, coin.w, coin.h) then
    score = score + 1
    coin.x = math.random(0, 740)  -- переставим цель в новое место
  end
end
```

Для кругов есть отдельная проверка через расстояние между центрами, но в аркадах
почти всегда хватает AABB: круг просто «оборачивают» в квадрат.

### 4. Спрайты
Спрайт — это картинка, которую рисуют в нужной точке. В полной версии LÖVE:

```lua
function love.load()
  player = love.graphics.newImage("player.png")
  playerW = player:getWidth()
  playerH = player:getHeight()
end

function love.draw()
  love.graphics.setColor(1, 1, 1)          -- спрайты рисуем белым, чтобы не тонировать
  love.graphics.draw(player, x, y)
end
```

Ещё можно поворачивать и масштабировать: `love.graphics.draw(img, x, y, angle, sx, sy)`.
Если картинок нет под рукой — не беда: любую «графику» можно собрать из
`rectangle` и `circle`, и она будет работать даже в предпросмотре. Именно так мы и
сделаем в заданиях.

### 5. Звук
Звук в полной версии LÖVE подключается так:

```lua
function love.load()
  jumpSound = love.audio.newSource("jump.wav", "static")
end

function love.keypressed(key)
  if key == "space" then
    jumpSound:play()
  end
end
```

`newSource(path, "static")` — для коротких эффектов, `"stream"` — для длинной музыки.
В предпросмотре звука нет, поэтому код со звуком мы только разберём, но в задания
вставлять не будем — иначе они не запустятся в браузере.

### 6. Состояния игры
Игра почти никогда не состоит из одного экрана. Есть меню, сама игра и экран
«проиграл/выиграл». Это и есть **состояния**. Держим их в обычной переменной:

```lua
function love.load()
  state = "menu"      -- "menu" | "play" | "gameover"
  score = 0
end

function love.update(dt)
  if state == "play" then
    -- двигаем игрока, ловим столкновения, копим счёт
  end
  -- в menu и gameover логику игры не обновляем
end

function love.draw()
  if state == "menu" then
    love.graphics.print("Нажми пробел, чтобы начать", 250, 200)
  elseif state == "play" then
    -- рисуем игрока, цель и счёт
  else
    love.graphics.print("Игра окончена. Счёт: " .. score, 250, 200)
  end
end

function love.keypressed(key)
  if state == "menu" and key == "space" then
    state = "play"
    score = 0
    resetGame()
  elseif state == "play" and key == "escape" then
    state = "menu"
  end
end
```

Главная идея: **`update` обновляет логику только в состоянии `play`**, а `draw`
рисует то, что соответствует текущему состоянию. Так меню и экран проигрыша не
мешают игре.

### 7. Собираем мини-игру
Сложим всё вместе — простая аркада «поймай квадрат»:

```lua
local player, coin, score, state

function love.load()
  state = "play"
  score = 0
  player = { x = 380, y = 380, w = 40, h = 40, speed = 300 }
  coin = { x = 400, y = 100, w = 30, h = 30 }
end

local function hit(ax, ay, aw, ah, bx, by, bw, bh)
  return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah
end

function love.update(dt)
  if state ~= "play" then return end
  coin.y = coin.y + 120 * dt                 -- цель медленно падает
  if coin.y > 450 then coin.y = -30; coin.x = math.random(0, 770) end
  if hit(player.x, player.y, player.w, player.h,
         coin.x, coin.y, coin.w, coin.h) then
    score = score + 1
    coin.x = math.random(0, 770)
    coin.y = -30
  end
end

function love.draw()
  love.graphics.clear(0.05, 0.05, 0.1)
  love.graphics.setColor(0.3, 0.8, 1)
  love.graphics.rectangle("fill", player.x, player.y, player.w, player.h)
  love.graphics.setColor(1, 0.8, 0.2)
  love.graphics.rectangle("fill", coin.x, coin.y, coin.w, coin.h)
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Счёт: " .. score, 20, 20)
end

function love.keypressed(key)
  if key == "left" then player.x = player.x - 40 end
  if key == "right" then player.x = player.x + 40 end
end
```

Вот и вся аркада: игрок, движущаяся цель, счёт и управление стрелками. Дальше её
можно украшать — добавить жизни, ускорение со временем, экран проигрыша.

### 8. Типичные ошибки
| Ошибка | Причина |
|---|---|
| Объект «проскакивает» сквозь цель | проверка столкновения вне `update` или сравнение не тех сторон |
| Игра не реагирует на клавиши | холст предпросмотра не в фокусе — кликни по нему |
| Счёт растёт каждый кадр подряд | нет переноса цели после столкновения |
| Спрайт или звук не грузится в предпросмотре | эти API не входят в подмножество — нужен love2d.org |
| После «игра окончена» всё ещё двигается | забыл проверку `if state ~= "play" then return end` |

## ✅ Запомнить
- `dt` — секунды между кадрами; позицию меняем на `скорость * dt`, скорость — на `ускорение * dt`.
- Столкновения AABB: четыре условия пересечения по осям x и y.
- Спрайты — `newImage` + `draw`; звук — `newSource` + `play`; в предпросмотре их нет.
- Состояния (`menu`/`play`/`gameover`) держим в переменной; логику обновляем только в `play`.
- Мини-игра = игрок + цель + столкновение + счёт + ввод.

---

## ✏️ Задания
1. `task1_deltatime` — плавно двигать объект со скоростью в пикселях в секунду.
2. `task2_collision` — поймать пересечение двух прямоугольников через AABB.
3. `task3_states` — меню → игра → финал: собрать мини-игру на состояниях.
