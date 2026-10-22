-- Урок 08, задание 2: СТЕК + НАСЛЕДОВАНИЕ
-- ======================================
-- ЗАДАНИЕ:
-- 1. Допиши класс Stack: push(x), pop(), peek(), size(), is_empty().
--    Хранение — в приватной для объекта таблице self.items.
--    pop/peek на пустом стеке → nil + "пусто".
-- 2. Создай класс-наследник CountedStack: считает ВСЕГДА pushed и popped
--    (два счётчика за всё время, даже если pop был неудачным? — реши сам
--    и зафиксируй решение комментарием: считать ли неудачный pop?).
--    Методы: stats() → вернуть pushed, popped; переопредели push/pop
--    с вызовом родительских через Stack.push(self, ...).
--    Наследование: setmetatable(CountedStack, {__index = Stack}).
-- 3. Метод parent-класса, вызываемый через точку с явным self:
--    Stack.push(self, x) — разбери, почему здесь ТОЧКА, а не двоеточие.
--    (Ответь комментарием: что подставится в self в каждом случае?)
--
-- ПРОВЕРКИ:
-- local s = Stack:new()
-- s:push(10); s:push(20)
-- print(s:pop())       -- 20
-- print(s:peek())      -- 10
-- print(s:size())      -- 1
-- local cs = CountedStack:new()
-- cs:push(1); cs:push(2); cs:pop(); cs:pop(); cs:pop()
-- local pushed, popped = cs:stats()
-- print(pushed, popped) -- зависит от твоего решения про неудачный pop;
--                       -- главное — обоснуй комментарием!
--
-- НАВОДКА МЕНТОРА: конструктор наследника — обычная схема:
--   function CountedStack:new()
--     local obj = Stack.new(self)  -- self здесь = CountedStack!
--     obj.pushed, obj.popped = 0, 0
--     return obj
--   end
-- Почему Stack.new(self), а не Stack:new()? Куда делся obj из родителя?
-- Разберись: родительский new делает setmetatable(obj, self) — а self
-- там уже CountedStack. Хитро? Да. Это и есть полиморфизм прототипов.

local Stack = {}
Stack.__index = Stack

function Stack:new()
  return setmetatable({items = {}}, self)
end

-- TODO: push, pop, peek, size, is_empty

-- TODO: класс CountedStack (наследник) + stats + переопределения
