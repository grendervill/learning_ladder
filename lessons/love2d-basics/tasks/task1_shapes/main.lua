-- Задание: домик из фигур
-- Дорисуй стены, крышу и солнце. Места помечены TODO.

function love.load()
  -- TODO: можешь задать здесь цвета фона и дома
end

function love.draw()
  -- TODO: очисти экран своим цветом фона
  love.graphics.clear(0.1, 0.1, 0.15)

  -- TODO: стены — прямоугольник
  love.graphics.setColor(0.9, 0.8, 0.6)
  -- love.graphics.rectangle("fill", 320, 250, 160, 150)

  -- TODO: крыша — треугольник через polygon
  love.graphics.setColor(0.8, 0.3, 0.2)
  -- love.graphics.polygon("fill", {300, 250, 400, 160, 500, 250})

  -- TODO: солнце — круг
  love.graphics.setColor(1, 0.9, 0.3)
  -- love.graphics.circle("fill", 120, 100, 45)
end
