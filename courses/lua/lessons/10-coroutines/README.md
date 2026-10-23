# Урок 10. Корутины: кооперативная многозадачность

## 🎯 Цель
Понять четвёртый «кирпичик» Lua после таблиц, функций и метатаблиц: корутины и их применение.

## 📖 Теория

### 1. Что такое корутина?
Обычная функция: вызвал → отработала → вернула. Корутина умеет **приостанавливаться
и продолжать с того же места**:

```lua
local co = coroutine.create(function()
  print("раз")
  coroutine.yield()      -- ПАУЗА: отдать управление наружу
  print("два")
end)

print(coroutine.status(co))  --> suspended
coroutine.resume(co)         --> раз
coroutine.resume(co)         --> два
print(coroutine.status(co))  --> dead (функция закончилась)
```

`create` — создать (возвращает объект-корутину, тип `thread`!).
`resume` — запустить/продолжить. `yield` — приостановиться (только изнутри!).
`status` — `suspended` / `running` / `dead` (+ `normal`, см. ниже).

### 2. Обмен данными: yield/resume — двусторонний канал
```lua
local co = coroutine.create(function(a)   -- a = первый resume-аргумент
  print("получила:", a)
  local b = coroutine.yield("пауза 1")    -- yield ВЕРНУЛ то, что даст 2-й resume
  print("получила:", b)
  return "готово"                          -- return = финальные значения resume
end)

print(coroutine.resume(co, "привет"))  --> true  получила: привет  | true  пауза 1
print(coroutine.resume(co, "мир"))     --> получила: мир            | true  готово
```

Схема: `resume` передаёт аргументы в `yield`/`функцию`; `yield`/`return` отдают
значения наружу как результаты `resume`. Первый элемент — всегда `ok` (не упала ли).

`coroutine.wrap` — та же корутина, но как функция (ошибки бросает наружу, а не в `ok`):
```lua
local gen = coroutine.wrap(function() for i = 1, 3 do coroutine.yield(i) end end)
print(gen())  --> 1
print(gen())  --> 2
```

### 3. Главный кейс: генераторы и конвейеры
Генератор Фибоначчи без хранения всего ряда:
```lua
local function fibs()
  return coroutine.wrap(function()
    local a, b = 0, 1
    while true do
      coroutine.yield(a)
      a, b = b, a + b
    end
  end)
end

for v in fibs() do
  if v > 20 then break end
  print(v)  --> 0 1 1 2 3 5 8 13
end
```
Сравни с итератором из урока 09: корутина хранит состояние в **локальных переменных
и точке выполнения**, а не в upvalue-счётчике. Сложные обходы (дерево!) пишутся
в разы проще: рекурсия + yield вместо ручного стека.

### 4. Планировщик (мини-кооперативная многозадачность)
```lua
local tasks = {}
local function spawn(f) tasks[#tasks + 1] = coroutine.create(f) end

spawn(function() for i = 1, 3 do print("A" .. i); coroutine.yield() end end)
spawn(function() for i = 1, 3 do print("B" .. i); coroutine.yield() end end)

while #tasks > 0 do                       -- крутим, пока есть живые
  for i = #tasks, 1, -1 do                 -- с КОНЦА (почему? подумай!)
    if coroutine.status(tasks[i]) == "dead" then
      table.remove(tasks, i)
    else
      coroutine.resume(tasks[i])
    end
  end
end
--> A1 B1 A2 B2 A3 B3 (перемежаются!)
```

Почему удаление с конца? `table.remove` сдвигает хвост — прямой проход пропустил бы
элементы. Классическая ловушка, запомни.

### 5. Продюсер–консьюмер
```lua
local producer = coroutine.wrap(function()
  for i = 1, 5 do coroutine.yield(i * i) end
end)
while true do
  local v = producer()
  if not v then break end
  print("потребил:", v)
end
```

### 6. Ограничения (важно!)
- `yield` нельзя через границу C-функции: `table.sort` с yield-компаратором упадёт.
  Правило: yield работает только в «чистом» Lua-коде стека корутины.
- Корутины — **кооперативные**: никто никого не прерывает. Забыл `yield` в цикле —
  повесил весь планировщик. Это не потоки ОС!
- `status == "normal"`: корутина A запустила B и ждёт — A в этот момент `normal`.
- Ошибка внутри: `resume` вернёт `false + текст`. Проверяй `ok`! Иначе молчаливая смерть.

## ✅ Запомнить
- `create/resume/yield/status`; `wrap` — сахар. Обмен данными — через resume↔yield.
- Генераторы: бесконечные ряды без памяти. Планировщик: цикл resume + удаление мёртвых с конца.
- Yield не работает через C-границу; кооперативность = сам отдавай управление.

---

## ✏️ Задания
1. `task1_gen.lua` — генератор простых чисел (решето + yield).
2. `task2_pipeline.lua` — конвейер продюсер→фильтр→потребитель.
3. `task3_scheduler.lua` — планировщик задач с ожиданием и сном.
