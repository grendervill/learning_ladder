# Урок 09. Замыкания и обработка ошибок

## 🎯 Цель
Понять upvalue, писать генераторы-итераторы и перестать бояться ошибок: `pcall`, `assert`.

## 📖 Теория

### 1. Замыкание: функция + её «рюкзак»
```lua
local function counter()
  local n = 0              -- upvalue: локальная переменная внешней функции
  return function()        -- анонимная функция ЗАХВАТЫВАЕТ n
    n = n + 1
    return n
  end
end

local c1 = counter()
print(c1())  --> 1
print(c1())  --> 2 (n живёт между вызовами!)
local c2 = counter()
print(c2())  --> 1 (у каждого замыкания СВОЯ n)
```

Каждый вызов `counter()` создаёт **новую** переменную `n` и новую функцию,
которая на неё ссылается. Функция + захваченные переменные = **замыкание**
(closure). Это не копия значения — это живая ссылка: внутренняя функция меняет
ту же `n`, которую видит только она.

Применение: счётчики, приватное состояние (помнишь модуль из урока 07? это оно),
фабрики функций, колбэки с памятью.

### 2. Свои итераторы для обобщённого `for`
Обобщённый `for` — это просто цикл над функцией-итератором:
```lua
-- итератор, дающий числа от min до max:
local function range(min, max, step)
  step = step or 1
  local i = min - step
  return function()       -- каждый вызов даёт следующее значение
    i = i + step
    if (step > 0 and i <= max) or (step < 0 and i >= max) then
      return i
    end                  -- nil = конец итерации
  end
end

for n in range(1, 5) do print(n) end  --> 1 2 3 4 5
```

Именно так устроены `pairs/ipairs` — они возвращают итератор + состояние.
`nil` от итератора = «значения кончились, выходи из цикла».

### 3. Ошибки: `error` и `assert`
```lua
local function divide(a, b)
  if b == 0 then
    error("деление на ноль!")  -- бросает ошибку с трассировкой
  end
  return a / b
end

local function set_age(age)
  assert(type(age) == "number", "возраст должен быть числом")  -- проверка-инвариант
  assert(age >= 0, "возраст не может быть отрицательным")
  -- assert(false, msg) == error(msg); assert(true) — ничего не делает
end
```
`error(msg)` — бросить. `error(msg, 0)` — без позиции (чистое сообщение),
`error(msg, 2)` — указать на вызывающего (для библиотек).

### 4. Ловля ошибок: `pcall` и `xpcall`
```lua
local ok, result = pcall(divide, 10, 2)  -- ok=true, result=5
local ok2, err = pcall(divide, 10, 0)    -- ok=false, err="...деление на ноль!"
if not ok2 then print("поймали:", err) end

-- с анонимной функцией:
local ok3, err3 = pcall(function() return divide(1, 0) end)
```

`xpcall(f, handler)` — то же, но ошибку сначала пропускает через `handler`
(там обычно добавляют `debug.traceback` для полной трассировки):
```lua
local ok, res = xpcall(
  function() return divide(1, 0) end,
  function(err) return "ОЙ: " .. err .. "\n" .. debug.traceback() end
)
```

Правило ментора: **лови ошибки на границах** (ввод пользователя, сеть, плагины —
помнишь `pcall(require, ...)` из урока 07?). Внутри чистой логики — пусть падают
громко через `assert`, так баги находятся быстрее.

### 5. `debug` — заглянуть под капот (кратко)
```lua
print(debug.traceback("где я?"))  -- стек вызовов строкой
local info = debug.getinfo(1)     -- инфо о текущей функции (что за функция, где)
```
Полный `debug.getupvalue/sethook` — в уроке 11.

## ✅ Запомнить
- Замыкание = функция + захваченные upvalue (живые ссылки, у каждого вызова свои).
- Итератор = функция, возвращающая следующее значение; `nil` = конец.
- `error` бросает, `assert` проверяет, `pcall` ловит (`ok, result = pcall(f, ...)`).
- Лови на границах системы, внутри — падай громко.

---

## ✏️ Задания
1. `task1_closure.lua` — банк: замыкание-счёт с историей.
2. `task2_iterators.lua` — свои итераторы: range, map, filter.
3. `task3_safe.lua` — защищённый калькулятор на pcall + assert.
