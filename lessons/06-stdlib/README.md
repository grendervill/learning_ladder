# Урок 06. Стандартная библиотека: string, math, os, table

## 🎯 Цель
Перестать изобретать велосипеды: освоить четыре главные библиотеки и работу с файлами.

## 📖 Теория

### 1. `string` — работа с текстом
```lua
local s = "Привет, Lua!"

print(#s)                          -- длина в БАЙТАХ
print(string.len(s))               -- то же самое
print(string.upper("abc"))         --> ABC
print(string.lower("ABC"))         --> abc
print(string.reverse("123"))       --> 321
print(string.sub(s, 1, 6))         -- подстрока с 1 по 6-й БАЙТ
print(string.rep("аб", 3))         --> абабаб

-- поиск и замена:
local i = string.find("hello", "ll")  --> 3 (позиция; найдёт и pattern!)
print(string.gsub("ааа", "а", "б"))   --> ббб (замена; вернёт ещё и count!)

-- форматирование (как printf):
print(string.format("Имя: %s, возраст: %d, рост: %.2f", "Алекс", 20, 1.756))
--> Имя: Алекс, возраст: 20, рост: 1.76
-- %s строка, %d целое, %f float, %.2f — 2 знака, %q — quoted, %x — hex
```

Методы через двоеточие (синтаксический сахар — подробности в уроке 08):
```lua
print(("hello"):upper())  --> HELLO  -- строка ведёт себя как объект!
```

> ⚠️ `string.sub/find` работают с **байтами**, не буквами! Для кириллицы в UTF-8
> один символ = 2 байта, `sub("привет", 1, 3)` разрежет букву пополам.
> Для букв есть библиотека `utf8`:
> ```lua
> print(utf8.len("привет"))        --> 6 (настоящие буквы!)
> print(utf8.char(65, 66))         --> AB
> for p, c in utf8.codes("привет") do ... end  -- обход по символам
> ```

### 2. Паттерны Lua (не regex!)
В `find/gmatch/gsub` работают **паттерны** — свой мини-язык, проще и слабее regex:

| Паттерн | Значение |
|---|---|
| `.` | любой символ |
| `%a` / `%A` | буква / НЕ буква |
| `%d` / `%D` | цифра / не цифра |
| `%w` | буква или цифра |
| `%s` | пробельный символ |
| `*` `+` `-` `?` | 0+, 1+, 0+ лениво, 0/1 |
| `^` `$` | начало / конец строки |
| `(...)` | захват (capture) |
| `%1` | ссылка на 1-й захват в замене |
| `%` + символ | экранирование (`%.` — именно точка) |

```lua
-- все числа в строке:
for num in string.gmatch("мне 20, а ему 35", "%d+") do print(num) end
-- разбить по словам:
for w in string.gmatch("a b  c", "%S+") do print("[" .. w .. "]") end
-- дата наоборот: 02.10.2026 -> 2026-10-02
print((string.gsub("02.10.2026", "(%d+)%.(%d+)%.(%d+)", "%3-%2-%1")))
--> 2026-10-02
```

### 3. `math`
```lua
math.floor(3.7)   --> 3      math.ceil(3.2)     --> 4
math.abs(-5)      --> 5      math.max(1, 9, 3)   --> 9
math.sqrt(16)     --> 4.0    math.pi             --> 3.14159...
math.floor(7/2)   --> 3

-- случайные числа:
math.randomseed(os.time())  -- посеять генератор (ОДИН раз в начале!)
print(math.random())        -- float [0, 1)
print(math.random(6))       -- целое 1..6 (кубик!)
print(math.random(10, 20))  -- целое 10..20
```

> ⚠️ Без `randomseed` каждый запуск даёт одну и ту же последовательность.
> Сеять надо один раз, не перед каждым `random`!

### 4. `os` — время и система
```lua
print(os.time())                       -- секунды с 1970-01-01 (timestamp)
print(os.date("%Y-%m-%d %H:%M:%S"))    -- форматированная дата
print(os.date("%d.%m.%Y"))             --> 02.10.2026
print(os.clock())                      -- время CPU (для замера скорости!)
local h = os.getenv("HOME")            -- переменная окружения
os.execute("ls")                       -- выполнить команду shell (осторожно!)
```

Замер скорости кода:
```lua
local t0 = os.clock()
-- ... код ...
print("прошло:", os.clock() - t0, "сек")
```

### 5. `table` углублённо
```lua
-- concat с диапазоном:
print(table.concat({"a","b","c","d"}, ",", 2, 3))  --> b,c
-- sort со своим компаратором (по убыванию):
table.sort({3,1,2}, function(a, b) return a > b end)
-- pack/unpack: упаковка vararg с сохранением nil:
local packed = table.pack(1, nil, 3)
print(packed.n)  --> 3 (настоящее количество, включая nil!)
```

### 6. Файлы: чтение и запись
```lua
-- ЗАПИСЬ:
local f = io.open("test.txt", "w")  -- "w" — перезаписать, "a" — дописать
f:write("строка 1\nстрока 2\n")
f:close()

-- ЧТЕНИЕ целиком:
local f = io.open("test.txt", "r")
if f then
  local content = f:read("*a")  -- "*a" = весь файл
  f:close()
  print(content)
else
  print("файл не найден!")
end

-- ЧТЕНИЕ построчно:
for line in io.lines("test.txt") do print(line) end
-- Режимы read: "*l" строка, "*n" число, "*a" всё, число N — N байт
```

> ⚠️ Всегда `close()` после работы! Незакрытый файл на запись может потерять данные.
> `io.open` возвращает `nil + сообщение` при ошибке — проверяй результат.

## ✅ Запомнить
- `string.format/gmatch/gsub/sub` — ядро текста. Паттерны ≠ regex (`%d`, `%.`, `%1`).
- Байты ≠ буквы для кириллицы → `utf8.len`. `randomseed` — один раз.
- `os.time/date/clock`, `io.open + :write/:read/:close`, `io.lines` для строк.
- `table.pack` сохраняет `nil`, `sort` — на месте, `concat` — склейка.

---

## ✏️ Задания
1. `task1_patterns.lua` — паттерны: извлечение данных из текста.
2. `task2_files.lua` — дневник: запись и чтение файла.
3. `task3_benchmark.lua` — замер скорости: `..` в цикле vs `table.concat`.
