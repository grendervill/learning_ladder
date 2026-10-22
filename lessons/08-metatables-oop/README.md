# Урок 08. Метатаблицы и ООП

## 🎯 Цель
Понять главный механизм расширяемости Lua и построить классы с наследованием на голых таблицах.

## 📖 Теория

### 1. Метатаблица: «а что если...»
У каждой таблицы может быть **метатаблица** — таблица с инструкциями «что делать
в особых ситуациях»:

```lua
local t = {}
local mt = {
  __add = function(a, b) return "сложение перехвачено!" end
}
setmetatable(t, mt)   -- прикрепили метатаблицу
print(t + 1)          --> сложение перехвачено!
```

Без метатаблицы `t + 1` упало бы с ошибкой. С ней — вызывается `__add`.
Такие ключи `__...` называются **метаметодами**.

### 2. `__index` — главный метаметод
Вызывается, когда ключа **нет** в таблице:
```lua
local proto = {greet = function(self) return "Привет, я " .. self.name end}
local obj = {name = "Алекс"}
setmetatable(obj, {__index = proto})
print(obj.greet(obj))  --> Привет, я Алекс
-- obj.greet не найден в obj → ищется в proto → найден → вызван
```

`__index` может быть и **таблицей** (тогда поиск идёт в ней), и **функцией**
(тогда вызывается `__index(t, key)` — можно вычислять значения на лету,
например ленивую загрузку или значения по умолчанию).

### 3. Двоеточие `:` — сахар для методов
```lua
function obj:greet() return "Привет, я " .. self.name end
-- РОВНО то же, что: function obj.greet(self) ... end
obj:greet()   -- РОВНО то же, что: obj.greet(obj)
```
`:` при определении прячет первый параметр `self`, при вызове — подставляет объект.
Забыл `:` при вызове — `self` станет `nil` и будет «index a nil value». Классика!

### 4. Классы через прототипы
```lua
-- Класс "Счёт":
local Account = {}
Account.__index = Account   -- инвариант: класс — сам себе __index!

function Account:new(balance)
  local obj = {balance = balance or 0}
  setmetatable(obj, self)   -- self = класс; obj наследует методы класса
  return obj
end

function Account:deposit(amount)
  self.balance = self.balance + amount
end

local acc = Account:new(100)
acc:deposit(50)
print(acc.balance)  --> 150
```

Разберём магию: `acc:deposit(50)` → в `acc` ключа нет → `__index` (это `Account`) →
нашёлся `deposit` → вызван с `self = acc` → `self.balance` меняется у `acc`. Готово!

### 5. Наследование
```lua
local VipAccount = {}
VipAccount.__index = VipAccount
setmetatable(VipAccount, {__index = Account})  -- класс наследует класс!
VipAccount.__index = VipAccount

function VipAccount:new(balance)
  local obj = Account.new(self, balance)  -- переиспользуем конструктор родителя
  obj.bonus = 10
  return obj
end

function VipAccount:deposit(amount)  -- переопределение (override)
  Account.deposit(self, amount + self.bonus)
end
```
Цепочка поиска: `obj` → `VipAccount` → `Account`. Не нашлось нигде → `nil`.

### 6. Другие метаметоды (обзор)
| Метаметод | Когда вызывается |
|---|---|
| `__index` | чтение отсутствующего ключа |
| `__newindex` | **запись** ключа (перехват присваивания! readonly, валидация) |
| `__add/sub/mul/div/mod/pow/unm` | арифметика (`-x` — `__unm`) |
| `__eq/lt/le` | сравнения (для `==` нужны ОБЕ таблицы с одним метаметодом!) |
| `__len` | `#t` (только 5.2+; в 5.1 игнорируется для таблиц) |
| `__tostring` | `print(t)` / `tostring(t)` — как красиво показать объект |
| `__call` | `t(...)` — вызов таблицы как функции! |
| `__gc` | финализатор при сборке мусора (подробно в уроке 11) |

Пример-вектор:
```lua
local Vec = {}
Vec.__index = Vec
function Vec:new(x, y) return setmetatable({x = x, y = y}, self) end
function Vec.__add(a, b) return Vec:new(a.x + b.x, a.y + b.y) end
function Vec:__tostring() return "(" .. self.x .. ", " .. self.y .. ")" end
local v = Vec:new(1, 2) + Vec:new(3, 4)
print(v)  --> (4, 6)
```
> 💡 `setmetatable` возвращает свою таблицу — поэтому `return setmetatable(...)` работает.

### 7. `__newindex` и readonly
```lua
local ro = setmetatable({}, {
  __newindex = function() error("только чтение!") end
})
ro.x = 1  --> ОШИБКА: только чтение!
```
Но внимательнее: `__newindex` срабатывает только если ключа ещё нет; плюс внутри
метатаблицы надо писать через `rawset`, иначе бесконечная рекурсия. Это уже в задании!

## ✅ Запомнить
- Метатаблица + метаметоды `__...` меняют поведение таблицы.
- `__index` (чтение) и `__newindex` (запись) — фундамент ООП.
- `:` прячет/подставляет `self`. Класс: `Class.__index = Class` + `setmetatable(obj, self)`.
- Наследование — цепочка `__index`. `__tostring/__add/__call` делают объекты живыми.

---

## ✏️ Задания
1. `task1_vector.lua` — вектор 2D: арифметика, сравнение, красивый вывод.
2. `task2_stack.lua` — класс Стек + наследование (СчётчикСтек).
3. `task3_readonly.lua` — readonly-обёртка через `__index`/`__newindex`.
