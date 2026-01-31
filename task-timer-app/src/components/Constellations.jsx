import { useState } from 'react';
import { useLanguage } from '../context/useLanguage';
import StarTooltip from './StarTooltip';
import './Constellations.css';

// ===== АСТРОНОМИЧЕСКИЕ ВЫЧИСЛЕНИЯ =====

// Функция для конвертации звездной величины в яркость (0-1)
const magnitudeTobrightness = (mag) => {
  const normalized = Math.max(0, Math.min(1, (4 - mag) / 5));
  return 0.3 + normalized * 0.7;
};

// Преобразование градусов в радианы
const toRadians = (deg) => deg * Math.PI / 180;
const toDegrees = (rad) => rad * 180 / Math.PI;

// Вычисление юлианской даты (для астрономических расчетов)
const getJulianDate = (date) => {
  const time = date.getTime() / 86400000 + 2440587.5;
  return time;
};

// Вычисление местного звездного времени (LST)
const getLocalSiderealTime = (longitude, date) => {
  const jd = getJulianDate(date);
  const d = jd - 2451545.0;
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lst = (gmst + longitude / 15) % 24;
  return lst;
};

// Преобразование экваториальных координат (RA, Dec) в горизонтальные (Alt, Az)
const _equatorialToHorizontal = (ra, dec, latitude, longitude, date) => {
  const lst = getLocalSiderealTime(longitude, date);
  const hourAngle = (lst * 15 - ra) % 360;
  
  const latRad = toRadians(latitude);
  const decRad = toRadians(dec);
  const haRad = toRadians(hourAngle);
  
  // Высота (altitude)
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + 
                 Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const alt = toDegrees(Math.asin(sinAlt));
  
  // Азимут
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / 
                (Math.cos(latRad) * Math.cos(toRadians(alt)));
  let az = toDegrees(Math.acos(Math.max(-1, Math.min(1, cosAz))));
  
  if (Math.sin(haRad) > 0) az = 360 - az;
  
  return { altitude: alt, azimuth: az };
};

// Проекция для отображения звездной карты (планисфера)
// Преобразуем RA и Dec в плоские координаты x,y
// Это как развернутая карта звездного неба - все созвездия видны
const _projectStarMap = (ra, dec) => {
  // RA (0-360°) → x (0-100)
  // Сдвигаем на 180° чтобы Орион был слева, Лебедь справа
  const x = ((ra + 180) % 360) / 360 * 100;
  
  // Dec (-90 до +90°) → y (100-0)
  // Показываем только северное полушарие и экваториальную зону (Dec: -20° до +90°)
  // Dec +90° (полюс) → y = 0 (верх экрана)
  // Dec -20° → y = 100 (низ экрана)
  const y = (90 - dec) / 110 * 100; // диапазон 110° (от +90 до -20)
  
  return { x, y };
};

// Функция проекции небесных координат на круг (стереографическая проекция)
const projectToCircle = (ra, dec) => {
  // Параметры проекции (под новый viewBox 90x90)
  const centerX = 45;
  const centerY = 45;
  const maxRadius = 44; // радиус круга звездной карты
  
  // Стереографическая проекция для планисферы
  // Dec: 90° (северный полюс) → центр, 0° (экватор) → край для северного неба
  // RA: 0-360° → угол вокруг центра
  
  const raRad = toRadians(ra);
  const _decRad = toRadians(dec);
  
  // Расстояние от центра (для северного неба, центр = северный полюс)
  const r = maxRadius * (90 - dec) / 90;
  
  // Позиция на круге (RA определяет угол, отсчет от севера по часовой стрелке)
  const angle = raRad - Math.PI / 2; // корректировка, чтобы 0h RA был вверху
  const x = centerX + r * Math.cos(angle);
  const y = centerY + r * Math.sin(angle);
  
  return { x, y };
};

// ===== ДАННЫЕ СОЗВЕЗДИЙ =====
// Координаты: РЕАЛЬНЫЕ из каталога Hipparcos (RA - прямое восхождение, Dec - склонение)
// Звездные данные: названия, величины (mag), цвета - РЕАЛЬНЫЕ астрономические данные

const CONSTELLATIONS = {
  ursaMajor: { 
    name: 'Большая Медведица',
    stars: [
      { ra: 165.93, dec: 61.75, mag: 1.79, name: 'Дубхе' },      // α UMa
      { ra: 165.46, dec: 56.38, mag: 2.37, name: 'Мерак' },      // β UMa
      { ra: 178.46, dec: 53.69, mag: 2.44, name: 'Фекда' },      // γ UMa
      { ra: 183.86, dec: 57.03, mag: 3.31, name: 'Мегрец' },     // δ UMa
      { ra: 193.51, dec: 55.96, mag: 1.77, name: 'Алиот' },      // ε UMa
      { ra: 200.98, dec: 54.93, mag: 2.09, name: 'Мицар' },      // ζ UMa
      { ra: 206.89, dec: 49.31, mag: 1.86, name: 'Бенетнаш' }    // η UMa
    ],
    lines: [[0,1], [1,2], [2,3], [3,0], [3,4], [4,5], [5,6]]
  },
  cassiopeia: {
    name: 'Кассиопея',
    stars: [
      { ra: 10.13, dec: 56.54, mag: 2.23, name: 'Шедар' },       // α Cas
      { ra: 2.29, dec: 59.15, mag: 2.27, name: 'Каф' },          // β Cas
      { ra: 14.18, dec: 60.72, mag: 2.47, name: 'Нави' },        // γ Cas
      { ra: 22.82, dec: 60.24, mag: 2.68, name: 'Рукбах' },      // δ Cas
      { ra: 28.60, dec: 63.67, mag: 3.38, name: 'Сегин' }        // ε Cas
    ],
    lines: [[0,1], [1,2], [2,3], [3,4]]
  },
  cygnus: {
    name: 'Лебедь',
    stars: [
      { ra: 310.36, dec: 45.28, mag: 1.25, name: 'Денеб' },      // α Cyg
      { ra: 305.56, dec: 40.26, mag: 2.20, name: 'Садр' },       // γ Cyg
      { ra: 311.55, dec: 33.97, mag: 2.46, name: 'Гиенах' },     // ε Cyg
      { ra: 296.24, dec: 45.13, mag: 2.87, name: 'Дельта' },     // δ Cyg
      { ra: 322.16, dec: 53.37, mag: 3.79, name: 'Каппа' }       // κ Cyg
    ],
    lines: [[0,1], [1,2], [1,3], [1,4]]
  },
  lyra: {
    name: 'Лира',
    stars: [
      { ra: 279.23, dec: 38.78, mag: 0.03, name: 'Вега' },       // α Lyr - Вега!
      { ra: 282.52, dec: 33.36, mag: 3.52, name: 'Шелиак' },     // β Lyr
      { ra: 284.74, dec: 32.69, mag: 3.24, name: 'Сулафат' },    // γ Lyr
      { ra: 281.19, dec: 37.60, mag: 4.36, name: 'Дзета' }       // ζ Lyr
    ],
    lines: [[0,1], [0,2], [1,3], [2,3]]
  },
  andromeda: {
    name: 'Андромеда',
    stars: [
      { ra: 2.10, dec: 29.09, mag: 2.06, name: 'Альферац' },     // α And
      { ra: 17.43, dec: 35.62, mag: 2.06, name: 'Мирах' },       // β And
      { ra: 30.97, dec: 42.33, mag: 2.26, name: 'Аламак' },      // γ And
      { ra: 8.50, dec: 30.86, mag: 3.27, name: 'Дельта' }        // δ And
    ],
    lines: [[0,1], [1,2], [0,3]]
  },
  perseus: {
    name: 'Персей',
    stars: [
      { ra: 51.08, dec: 49.86, mag: 1.80, name: 'Мирфак' },     // α Per
      { ra: 47.04, dec: 40.96, mag: 2.12, name: 'Алголь' },     // β Per
      { ra: 45.57, dec: 53.51, mag: 2.93, name: 'Гамма' },      // γ Per
      { ra: 56.08, dec: 47.79, mag: 3.01, name: 'Дельта' }      // δ Per
    ],
    lines: [[0,1], [0,2], [0,3]]
  },
  auriga: {
    name: 'Возничий',
    stars: [
      { ra: 79.17, dec: 45.99, mag: 0.08, name: 'Капелла' },      // α Aur
      { ra: 89.88, dec: 44.95, mag: 1.90, name: 'Менкалинан' },   // β Aur
      { ra: 75.62, dec: 43.82, mag: 2.62, name: 'Эпсилон' },      // ε Aur
      { ra: 74.25, dec: 33.17, mag: 2.69, name: 'Йота' },         // ι Aur
      { ra: 89.93, dec: 37.21, mag: 2.62, name: 'Тета' }          // θ Aur
    ],
    lines: [[0,1], [1,2], [2,3], [3,4], [4,0]]
  },
  draco: {
    name: 'Дракон',
    stars: [
      { ra: 213.92, dec: 64.38, mag: 3.65, name: 'Тубан' },      // α Dra
      { ra: 262.61, dec: 52.30, mag: 2.79, name: 'Растабан' },   // β Dra
      { ra: 269.15, dec: 51.49, mag: 2.23, name: 'Этамин' },     // γ Dra
      { ra: 287.44, dec: 67.66, mag: 3.07, name: 'Дельта' },     // δ Dra
      { ra: 239.71, dec: 65.71, mag: 3.17, name: 'Дзета' },      // ζ Dra
      { ra: 255.14, dec: 72.15, mag: 3.57, name: 'Хи' }          // χ Dra
    ],
    lines: [[0,1], [1,2], [2,3], [3,4], [4,5]]
  },
  orion: {
    name: 'Орион',
    stars: [
      { ra: 88.79, dec: 7.41, mag: 0.50, name: 'Бетельгейзе' },  // α Ori - красный гигант
      { ra: 81.28, dec: 6.35, mag: 1.64, name: 'Беллатрикс' },   // γ Ori
      { ra: 78.63, dec: -8.20, mag: 0.12, name: 'Ригель' },      // β Ori - голубой гигант
      { ra: 86.94, dec: -9.67, mag: 2.06, name: 'Саиф' },        // κ Ori
      { ra: 84.05, dec: -1.20, mag: 1.70, name: 'Альнилам' },    // ε Ori - пояс центр
      { ra: 85.19, dec: -1.94, mag: 1.77, name: 'Альнитак' },    // ζ Ori - пояс лево
      { ra: 83.00, dec: -0.30, mag: 2.23, name: 'Минтака' }      // δ Ori - пояс право
    ],
    lines: [[0,1], [0,5], [1,6], [2,5], [3,6], [5,4], [4,6]]
  },
  taurus: {
    name: 'Телец',
    stars: [
      { ra: 68.98, dec: 16.51, mag: 0.85, name: 'Альдебаран' },  // α Tau - красный гигант
      { ra: 81.57, dec: 28.61, mag: 1.65, name: 'Нат' },         // β Tau
      { ra: 56.87, dec: 24.11, mag: 3.00, name: 'Альциона' },    // η Tau - Плеяды
      { ra: 54.26, dec: 15.87, mag: 2.87, name: 'Дзета' }        // ζ Tau
    ],
    lines: [[0,1], [0,3], [2,3]]
  },
  gemini: {
    name: 'Близнецы',
    stars: [
      { ra: 116.33, dec: 28.03, mag: 1.58, name: 'Кастор' },     // α Gem
      { ra: 112.31, dec: 28.03, mag: 1.14, name: 'Поллукс' },    // β Gem
      { ra: 113.65, dec: 16.40, mag: 2.88, name: 'Альхена' },    // γ Gem
      { ra: 95.74, dec: 22.51, mag: 3.36, name: 'Мебсута' }      // ε Gem
    ],
    lines: [[0,1], [0,2], [1,2], [2,3]]
  },
  leo: {
    name: 'Лев',
    stars: [
      { ra: 152.09, dec: 11.97, mag: 1.35, name: 'Регул' },      // α Leo
      { ra: 177.26, dec: 14.57, mag: 2.14, name: 'Денебола' },   // β Leo
      { ra: 169.62, dec: 23.77, mag: 2.61, name: 'Альгиеба' },   // γ Leo
      { ra: 168.56, dec: 20.52, mag: 2.56, name: 'Зосма' },      // δ Leo
      { ra: 141.90, dec: 20.17, mag: 2.98, name: 'Альгенуби' }   // ε Leo
    ],
    lines: [[0,4], [4,2], [2,3], [3,1], [2,0]]
  },
  virgo: {
    name: 'Дева',
    stars: [
      { ra: 201.30, dec: -11.16, mag: 0.97, name: 'Спика' },     // α Vir
      { ra: 190.42, dec: 1.76, mag: 2.75, name: 'Виндемиатрикс' }, // ε Vir
      { ra: 224.02, dec: -10.27, mag: 3.38, name: 'Поррима' }    // γ Vir
    ],
    lines: [[0,1], [0,2]]
  },
  bootes: {
    name: 'Волопас',
    stars: [
      { ra: 213.92, dec: 19.18, mag: -0.04, name: 'Арктур' },    // α Boo - очень яркая!
      { ra: 210.96, dec: 38.31, mag: 2.68, name: 'Неккар' },     // β Boo
      { ra: 222.72, dec: 27.07, mag: 3.03, name: 'Сегинус' }     // γ Boo
    ],
    lines: [[0,1], [0,2]]
  }
};

// Генерация фоновых звезд для создания реалистичной плотности неба
const generateBackgroundStars = (count = 500) => {
  const stars = [];
  const seed = 12345;
  
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  
  // Генерируем звезды с реальными координатами RA/Dec
  for (let i = 0; i < count; i++) {
    stars.push({
      ra: random() * 360,              // прямое восхождение 0-360°
      dec: -20 + random() * 100,       // склонение от -20° до +80° (северное небо)
      mag: 3.5 + random() * 2.5,       // звездная величина 3.5-6.0
      colorIndex: Math.floor(random() * 7)
    });
  }
  
  return stars;
};

const BACKGROUND_STARS = generateBackgroundStars(500);

// Цвета для фоновых звезд (упрощенная версия спектральных классов)
const BACKGROUND_STAR_COLORS = [
  '#AAD4FF',   // O, B - голубые гиганты (10%)
  '#64B5F6',   // B - яркие голубые (15%)
  '#FFFFFF',   // A - белые (20%)
  '#FFF9D0',   // F - желтовато-белые (20%)
  '#FFEB3B',   // G - желтые (15%)
  '#FFB347',   // K - оранжевые (15%)
  '#FF6B6B'    // M - красные (5%)
];


// Спектральные цвета звезд (по классам O, B, A, F, G, K, M)
const STAR_COLORS = {
  blueGiant: '#AAD4FF',   // Голубые гиганты (O, B класс)
  blue: '#64B5F6',        // Яркие голубые
  white: '#FFFFFF',       // Белые звезды (A класс - Вега, Сириус)
  yellowWhite: '#FFF9D0', // Желтовато-белые (F класс)
  yellow: '#FFEB3B',      // Желтые (G класс - как Солнце)
  orange: '#FFB347',      // Оранжевые (K класс)
  red: '#FF6B6B',         // Красные (M класс)
  redGiant: '#FF4757'     // Красные гиганты (Бетельгейзе)
};

// Назначаем цвета известным звездам
const getStarColor = (constellationKey, starIndex) => {
  const colorMap = {
    'ursaMajor': [STAR_COLORS.white, STAR_COLORS.white, STAR_COLORS.yellowWhite, STAR_COLORS.white, STAR_COLORS.yellowWhite, STAR_COLORS.white, STAR_COLORS.yellowWhite],
    'cassiopeia': [STAR_COLORS.yellowWhite, STAR_COLORS.blue, STAR_COLORS.yellowWhite, STAR_COLORS.blue, STAR_COLORS.yellowWhite],
    'cygnus': [STAR_COLORS.blueGiant, STAR_COLORS.yellow, STAR_COLORS.blue, STAR_COLORS.orange, STAR_COLORS.white],
    'lyra': [STAR_COLORS.blue, STAR_COLORS.white, STAR_COLORS.white, STAR_COLORS.yellowWhite],
    'andromeda': [STAR_COLORS.yellowWhite, STAR_COLORS.orange, STAR_COLORS.blue, STAR_COLORS.white],
    'perseus': [STAR_COLORS.yellowWhite, STAR_COLORS.blue, STAR_COLORS.orange, STAR_COLORS.yellow],
    'auriga': [STAR_COLORS.yellow, STAR_COLORS.blue, STAR_COLORS.white, STAR_COLORS.orange, STAR_COLORS.white],
    'draco': [STAR_COLORS.orange, STAR_COLORS.yellow, STAR_COLORS.yellowWhite, STAR_COLORS.white, STAR_COLORS.orange, STAR_COLORS.yellowWhite],
    'orion': [STAR_COLORS.redGiant, STAR_COLORS.blue, STAR_COLORS.blueGiant, STAR_COLORS.blue, STAR_COLORS.blue, STAR_COLORS.blue, STAR_COLORS.blue],
    'taurus': [STAR_COLORS.orange, STAR_COLORS.blue, STAR_COLORS.blue, STAR_COLORS.white],
    'gemini': [STAR_COLORS.white, STAR_COLORS.orange, STAR_COLORS.white, STAR_COLORS.yellow],
    'leo': [STAR_COLORS.blueGiant, STAR_COLORS.white, STAR_COLORS.orange, STAR_COLORS.yellowWhite, STAR_COLORS.yellowWhite],
    'virgo': [STAR_COLORS.blue, STAR_COLORS.yellow, STAR_COLORS.white],
    'bootes': [STAR_COLORS.orange, STAR_COLORS.yellow, STAR_COLORS.white]
  };
  
  return colorMap[constellationKey]?.[starIndex] || STAR_COLORS.white;
};

function Constellations({ activeTasks = [], onTaskClick }) {
  const { t } = useLanguage();
  const [backgroundStars] = useState(BACKGROUND_STARS);

  // Функция поиска позиции для цвета задачи (в координатах viewBox)
  const findPositionForColor = (taskColor, taskIndex) => {
    const allStars = [];
    
    // Проецируем все звезды созвездий на круг
    Object.entries(CONSTELLATIONS).forEach(([key, constellation]) => {
      constellation.stars.forEach((star, i) => {
        const projected = projectToCircle(star.ra, star.dec);
        const starColor = getStarColor(key, i);
        
        // Проверяем что звезда внутри круга радиусом 44
        const dx = projected.x - 45;
        const dy = projected.y - 45;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (distanceFromCenter <= 44) {
          allStars.push({ x: projected.x, y: projected.y, color: starColor });
        }
      });
    });
    
    if (allStars.length === 0) return { x: 45, y: 45 };
    
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const taskRgb = hexToRgb(taskColor);
    if (!taskRgb) return { x: 45, y: 45 };
    
    // Вычисляем расстояния до всех звезд
    const starsWithDistance = allStars.map(star => {
      const starRgb = hexToRgb(star.color);
      if (!starRgb) return { ...star, distance: Infinity };
      
      const distance = Math.sqrt(
        Math.pow(taskRgb.r - starRgb.r, 2) +
        Math.pow(taskRgb.g - starRgb.g, 2) +
        Math.pow(taskRgb.b - starRgb.b, 2)
      );
      
      return { ...star, distance };
    });
    
    // Сортируем по расстоянию и берем топ-20 самых подходящих по цвету
    const topStars = starsWithDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);
    
    // Выбираем СЛУЧАЙНУЮ звезду из топ-20 близких по цвету
    // Используем цвет задачи как seed для генерации псевдослучайного числа
    const seed = taskColor.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + taskIndex;
    const randomIndex = Math.floor((Math.sin(seed) * 10000) % topStars.length);
    const selectedStar = topStars[Math.abs(randomIndex)];
    
    return { x: selectedStar.x, y: selectedStar.y };
  };
  
  return (
    <div className="constellations-container">
      <svg className="constellations-svg" viewBox="0 0 90 90" preserveAspectRatio="xMidYMid meet">
        {/* Круглая рамка звездной карты */}
        <defs>
          <clipPath id="circleClip">
            <circle cx="45" cy="45" r="44" />
          </clipPath>
        </defs>
        
        <circle cx="45" cy="45" r="44" fill="#000814" opacity="0.9" />
        
        <g clipPath="url(#circleClip)">
          {/* Фоновые звезды */}
          <g className="background-stars">
            {backgroundStars.map((star, i) => {
              const pos = projectToCircle(star.ra, star.dec);
              const brightness = magnitudeTobrightness(star.mag);
              const radius = brightness * 0.22;
              const color = BACKGROUND_STAR_COLORS[star.colorIndex];
              const glowIntensity = brightness * 0.6;
              
              return (
                <circle
                  key={`bg-${i}`}
                  cx={pos.x}
                  cy={pos.y}
                r={radius}
                fill={color}
                opacity={0.7 + brightness * 0.2}
                className="background-star"
                style={{
                  filter: `drop-shadow(0 0 ${glowIntensity}px ${color})`
                }}
              />
            );
          })}
        </g>
        
          {/* Рисуем созвездия */}
          {Object.entries(CONSTELLATIONS).map(([key, constellation]) => {
            return (
              <g key={key} className="constellation">
                {/* Звезды созвездия */}
                {constellation.stars.map((star, i) => {
                  const pos = projectToCircle(star.ra, star.dec);
                  const brightness = magnitudeTobrightness(star.mag);
                  const radius = brightness * 0.4;
                  const color = getStarColor(key, i);
                  const glowIntensity = brightness * 1.5;
                  
                  const starName = t(`stars.${star.name}`) || star.name;
                  const constellationName = t(`constellations.${key}`) || constellation.name;
                  const tooltipContent = `${starName} • ${constellationName} • ⭐ ${star.mag.toFixed(2)}`;
                  
                  return (
                    <StarTooltip 
                      key={i} 
                      content={tooltipContent}
                      position={{ x: pos.x, y: pos.y }}
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius}
                        fill={color}
                        opacity={0.95}
                        style={{
                          filter: `drop-shadow(0 0 ${glowIntensity}px ${color})`,
                          cursor: 'pointer'
                        }}
                      />
                    </StarTooltip>
                  );
                })}
              </g>
            );
          })}
        </g>
        
        {/* Пульсирующие звезды активных задач */}
        {activeTasks.map((task, index) => {
          const position = findPositionForColor(task.color, index);
          
          return (
            <g key={task.id} className="active-task-star">
              {/* Пульсация 1 - внешняя */}
              <circle
                cx={position.x}
                cy={position.y}
                r="1.5"
                fill={task.color}
                opacity="0.2"
              >
                <animate
                  attributeName="r"
                  values="1.5;3;1.5"
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${index * 0.3}s`}
                />
                <animate
                  attributeName="opacity"
                  values="0.2;0.5;0.2"
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${index * 0.3}s`}
                />
              </circle>
              
              {/* Пульсация 2 - средняя */}
              <circle
                cx={position.x}
                cy={position.y}
                r="1.2"
                fill={task.color}
                opacity="0.4"
              >
                <animate
                  attributeName="r"
                  values="1.2;2.2;1.2"
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${index * 0.3}s`}
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0.7;0.4"
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${index * 0.3}s`}
                />
              </circle>
              
              {/* Ядро */}
              <circle
                cx={position.x}
                cy={position.y}
                r="0.8"
                fill={task.color}
                opacity="1"
                className="star-core"
                style={{ cursor: 'pointer' }}
                onClick={() => onTaskClick && onTaskClick(task)}
              >
                <title>{task.name}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Конвертация HEX в RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Находим позицию звезды в зависимости от цвета задачи
function _findPositionForColor(color) {
  // Собираем все звезды со всех созвездий с их цветами
  const allStars = [];
  Object.entries(CONSTELLATIONS).forEach(([constKey, constellation]) => {
    constellation.stars.forEach((star, starIdx) => {
      const starColor = getStarColor(constKey, starIdx);
      allStars.push({
        x: star.x,
        y: star.y,
        color: starColor,
        constellation: constKey,
        index: starIdx
      });
    });
  });
  
  // Функция для вычисления расстояния между цветами
  const colorDistance = (color1, color2) => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return Infinity;
    
    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );
  };
  
  // Ищем звезду с наиболее похожим цветом
  let closestStar = null;
  let minDistance = Infinity;
  
  allStars.forEach(star => {
    const distance = colorDistance(color, star.color);
    if (distance < minDistance) {
      minDistance = distance;
      closestStar = star;
    }
  });
  
  // Всегда используем звезду с наиболее похожим цветом
  if (closestStar) {
    return {
      x: closestStar.x,
      y: closestStar.y
    };
  }
  
  // Если по какой-то причине не нашли звезду, используем первую
  return {
    x: allStars[0].x,
    y: allStars[0].y
  };
}

export { STAR_COLORS };
export default Constellations;
