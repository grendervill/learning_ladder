-- Задание: поймай цель (проверка столкновений AABB)
-- Игрок ловит падающую цель; при столкновении счёт растёт, цель переставляется.

function love.load()
  -- TODO: игрок, цель и счёт
  -- player = { x = 380, y = 380, w = 40, h = 40 }
  -- coin = { x = 400, y = 0, w = 30, h = 30 }
  -- score = 0
end

-- TODO: напиши проверку AABB
local function hit(ax, ay, aw, ah, bx, by, bw, bh)
  -- return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah
end

function love.update(dt)
  -- TODO: двигай цель вниз и возвращай наверх за нижним краем
  -- coin.y = coin.y + 120 * dt
  -- if coin.y > 450 then coin.y = -30; coin.x = math.random(0, 770) end

  -- TODO: проверь столкновение игрока и цели
  -- if hit(player.x, player.y, player.w, player.h, coin.x, coin.y, coin.w, coin.h) then
  --   score = score + 1
  --   coin.x = math.random(0, 770)
  --   coin.y = -30
  -- end
end

function love.draw()
  love.graphics.clear(0.05, 0.05, 0.1)

  love.graphics.setColor(0.3, 0.8, 1)
  -- TODO: нарисуй игрока
  -- love.graphics.rectangle("fill", player.x, player.y, player.w, player.h)

  love.graphics.setColor(1, 0.8, 0.2)
  -- TODO: нарисуй цель
  -- love.graphics.rectangle("fill", coin.x, coin.y, coin.w, coin.h)

  love.graphics.setColor(1, 1, 1)
  -- TODO: выведи счёт
  -- love.graphics.print("Счёт: " .. score, 20, 20)
end

function love.keypressed(key)
  -- TODO: управление стрелками
  -- if key == "left" then player.x = player.x - 40 end
  -- if key == "right" then player.x = player.x + 40 end
end
