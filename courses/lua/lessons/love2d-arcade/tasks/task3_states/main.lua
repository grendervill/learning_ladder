-- Задание: меню -> игра -> финал (состояния)
-- Собери мини-игру: в меню по пробелу начинается игра, при промахе — экран финала.

function love.load()
  -- TODO: состояние, счёт, игрок и цель
  -- state = "menu"
  -- score = 0
  -- player = { x = 380, y = 380, w = 40, h = 40 }
  -- coin = { x = 400, y = 0, w = 30, h = 30 }
end

-- TODO: функция сброса цели
local function resetCoin()
  -- coin.x = math.random(0, 770)
  -- coin.y = -30
end

function love.update(dt)
  -- TODO: обновляй логику только в состоянии "play"
  -- if state ~= "play" then return end
  -- coin.y = coin.y + 140 * dt
  -- if coin.y > 450 then state = "gameover" end
  -- ... столкновение и счёт
end

function love.draw()
  love.graphics.clear(0.05, 0.05, 0.1)

  -- TODO: отрисуй меню
  -- if state == "menu" then
  --   love.graphics.setColor(1, 1, 1)
  --   love.graphics.print("Нажми пробел, чтобы начать", 280, 200)
  -- end

  -- TODO: отрисуй игру (игрок, цель, счёт)

  -- TODO: отрисуй экран финала
  -- if state == "gameover" then
  --   love.graphics.setColor(1, 1, 1)
  --   love.graphics.print("Игра окончена. Счёт: " .. score, 300, 200)
  -- end
end

function love.keypressed(key)
  -- TODO: пробел в меню начинает игру
  -- if state == "menu" and key == "space" then
  --   state = "play"; score = 0; resetCoin()
  -- end

  -- TODO: стрелки двигают игрока в игре
  -- if state == "play" and key == "left" then player.x = player.x - 40 end
  -- if state == "play" and key == "right" then player.x = player.x + 40 end
end
