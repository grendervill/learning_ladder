-- Задание: движение со скоростью в пикселях в секунду
-- Сдвинь квадрат на speed * dt и отражай от краёв.

function love.load()
  -- TODO: начальная позиция и скорость
  -- x = 40
  -- y = 210
  -- speed = 200
end

function love.update(dt)
  -- TODO: сдвинь квадрат
  -- x = x + speed * dt

  -- TODO: отрази от правого и левого края (окно 800, квадрат 40)
  -- if x > 760 then speed = -speed end
  -- if x < 0 then speed = -speed end
end

function love.draw()
  love.graphics.clear(0.05, 0.05, 0.1)
  love.graphics.setColor(0.4, 0.9, 0.5)
  -- TODO: нарисуй квадрат в позиции x
  -- love.graphics.rectangle("fill", x, y, 40, 40)
end
