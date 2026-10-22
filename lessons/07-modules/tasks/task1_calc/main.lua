-- Проверка калькулятора (Урок 07, задание 1, файл 2 из 2)
-- ========================================================
-- Этот файл НЕ МЕНЯЙ. Он подключает твой calc.lua через require.
-- ЗАПУСК ИЗ ПАПКИ task1_calc:
--   cd lessons/07-modules/tasks/task1_calc && lua main.lua

local calc = require("calc")

local function expect(name, fn, want, ...)
  if type(fn) ~= "function" then
    print("TODO " .. name .. ": функция ещё не написана в calc.lua")
    return
  end
  local got = fn(...)
  if got == want then
    print("OK  " .. name)
  else
    print("FAIL " .. name .. ": ожидалось " .. tostring(want) .. ", получено " .. tostring(got))
  end
end

expect("add", calc.add, 5, 2, 3)
expect("sub", calc.sub, 6, 10, 4)
expect("mul", calc.mul, 21, 3, 7)
expect("div", calc.div, 5, 20, 4)

if type(calc.div) ~= "function" then
  print("TODO div0: допиши M.div с проверкой деления на ноль")
else
  local res, err = calc.div(1, 0)
  expect("div0-value", function() return res end, nil)
  print("div0-err: " .. tostring(err) .. " (ожидалось сообщение про ноль)")
end

print("Готово. Все OK — задание принято. FAIL — чини calc.lua.")
