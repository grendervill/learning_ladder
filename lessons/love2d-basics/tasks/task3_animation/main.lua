-- Задание: движущийся круг
-- Заставь круг ехать вправо и отражаться от края.

function love.load()
  -- TODO: начальная позиция и скорость
  -- x = 60
  -- speed = 200
end

function love.update(dt)
  -- TODO: сдвинь круг с учётом dt
  -- x = x + speed * dt

  -- TODO: отрази от правого края окна (ширина 800)
  -- if x > 800 then speed = -speed end
  -- TODO: отрази от левого края
  -- if x < 0 then speed = -speed end
end

function love.draw()
  love.graphics.clear(0.05, 0.05, 0.1)
  love.graphics.setColor(0.3, 0.8, 1)
  -- TODO: нарисуй круг в позиции x
  -- love.graphics.circle("fill", x, 225, 30)
end
