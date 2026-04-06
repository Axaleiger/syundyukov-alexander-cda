/**
 * Данные для графика "Этап выбранного жизненного цикла актива" (1965–2065).
 * Объём затрат, млрд руб.
 */

const START_YEAR = 1965
const END_YEAR = 2065

const GEOLOGORAZVEDKA = {
  1965: 3.9, 1966: 3.898, 1967: 3.896, 1968: 3.894, 1969: 3.892, 1970: 3.85, 1971: 3.84, 1972: 3.82,
  1973: 3.8, 1974: 3.7, 1975: 3.6, 1976: 3.54, 1977: 3.45, 1978: 3.4, 1979: 3.3, 1980: 3.15, 1981: 2.95,
  1982: 2.7, 1983: 2.2, 1984: 1.9, 1985: 1.6, 1986: 1.3, 1987: 0.9, 1988: 0.6, 1989: 0,
}
for (let y = 1990; y <= 2027; y++) GEOLOGORAZVEDKA[y] = 0
const GEOLOGORAZVEDKA_TAIL = {
  2028: 0.1, 2029: 0.2, 2030: 0.4, 2031: 0.6, 2032: 0.76, 2033: 0.8, 2034: 0.84, 2035: 0.89, 2036: 0.94,
  2037: 1.02, 2038: 1.09, 2039: 1.15, 2040: 1.21, 2041: 1.28, 2042: 1.34, 2043: 1.37, 2044: 1.41, 2045: 1.44,
  2046: 1.476666667, 2047: 1.511666667, 2048: 1.546666667, 2049: 1.581666667, 2050: 1.616666667,
  2051: 1.651666667, 2052: 1.686666667, 2053: 1.721666667, 2054: 1.73, 2055: 1.738333333, 2056: 1.746666667,
  2057: 1.755, 2058: 1.763333333, 2059: 1.771666667, 2060: 1.78, 2061: 1.788333333, 2062: 1.796666667,
  2063: 1.805, 2064: 1.813333333, 2065: 1.821666667,
}
Object.assign(GEOLOGORAZVEDKA, GEOLOGORAZVEDKA_TAIL)

function parseValues(str, emptyVal = 0) {
  const raw = str.replace(/пусто/g, '0').replace(/оддиннадцать/gi, '11').split(',')
  const out = []
  let i = 0
  while (i < raw.length) {
    const t = raw[i].trim()
    if (t === '') { i++; continue }
    const next = raw[i + 1]
    if (next !== undefined && /^\d{2}$/.test(next.trim())) {
      out.push(parseFloat(t + '.' + next.trim()) || emptyVal)
      i += 2
    } else if (next !== undefined && /^\d{1}$/.test(next.trim())) {
      out.push(parseFloat(t + '.' + next.trim()) || emptyVal)
      i += 2
    } else {
      const n = parseFloat(t.replace(',', '.'))
      out.push(Number.isNaN(n) ? emptyVal : n)
      i++
    }
  }
  return out
}

const RAZRABOTKA_STR = '0,0,25,0,5,0,75,1,05,1,35,1,65,1,95,2,25,2,55,2,85,3,15,3,45,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,73,3,6,3,5,3,35,3,23,2,8,2,6,2,42,2,28,2,06,1,9,1,8,1,7,1,6,1,5,1,4,1,25,1,17,1,09,0,99,0,97,0,95,0,97,0,99,1,09,1,17,1,25,1,34,1,38,1,44,1,52,1,6,1,73,1,82,1,92,2,03,2,12,2,22,2,34,2,41,2,55,2,67,2,72,2,74,2,76,2,78,2,81,2,84,2,87,2,9,2,93,2,96,2,97,2,98,2,99,3,3,01,3,02,3,03,3,04,3,05,3,06,3,07,3,08,3,1,3,12,3,14,3,16,3,18,3,2,3,22,3,24'
const PLANIROVANIE_STR = '0,0,1,0,2,0,27,0,34,0,41,0,48,0,55,0,62,0,69,0,76,0,9,1,04,1,18,1,32,1,46,1,6,1,82,2,2,2,5,2,83,3,18,3,3,3,42,3,54,3,66,3,75,3,8,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,81,3,75,3,7,3,65,3,58,3,5,3,3,3,12,3,2,88,2,76,2,64,2,52,2,4,2,28,2,15,2,05,1,98,1,93,1,88,1,83,1,78,1,73,1,69,1,64,1,6,1,6,1,59,1,59,1,59,1,59,1,6,1,64,1,69,1,83,1,97,2,11,2,25,2,39,2,44,2,55,2,66,2,77,2,88,2,99'
const BURENIE_STR = '0,0,0,0,0,0,0,25,0,5,0,75,1,05,1,35,1,65,1,95,2,25,2,55,2,85,3,15,3,45,3,6,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,75,3,73,3,65,3,58,3,5,3,3,3,12,3,2,88,2,76,2,64,2,52,2,4,2,28,2,15,2,05,1,98,1,93,1,88,1,83,1,78,1,73,1,69,1,64,1,6,1,6,1,59,1,59,1,59,1,6,1,6,1,59,1,59,1,59,1,59,1,6,1,64,1,69,1,83,1,97,2,11,2,25,2,39,2,44,2,55,2,66,2,77,2,88,2,99'
const DOBYCHA_STR = '11,0,0,0,06,0,12,0,18,0,24,0,3,0,36,0,42,0,48,0,54,0,64,0,74,0,84,0,94,1,04,1,14,1,2,1,26,1,32,1,38,1,44,1,5,1,56,1,62,1,75,1,82,1,89,1,96,2,03,2,1,2,17,2,24,2,31,2,38,2,45,2,52,2,59,2,66,2,73,2,8,2,87,2,94,3,01,3,08,3,15,3,22,3,29,3,36,3,43,3,5,3,57,3,64,3,71,3,78,3,82,3,86,3,9,3,94,3,98,4,4,4,4,4,4,4,4,4,4'

const razrabotkaArr = parseValues(RAZRABOTKA_STR)
const planirovanieArr = parseValues(PLANIROVANIE_STR)
const burenieArr = parseValues(BURENIE_STR)
const dobychaArr = parseValues(DOBYCHA_STR)

function padArr(arr, len, fill = 0) {
  if (arr.length >= len) return arr.slice(0, len)
  return [...arr, ...Array(len - arr.length).fill(fill)]
}

/** Множители относительно бурения: бурение 1, обустройство 0.9, геологоразведка 0.25, добыча 0.4, разработка 0.1. */
const STAGE_PEAK_SCALE = { geologorazvedka: 0.25, razrabotka: 0.1, planirovanie: 0.9, burenie: 1, dobycha: 0.4 }

export function getLifecycleStreamData() {
  const years = []
  const rLen = END_YEAR - START_YEAR + 1
  const raz = padArr(razrabotkaArr, rLen)
  const pla = padArr(planirovanieArr, rLen)
  const bur = padArr(burenieArr, rLen)
  const dob = padArr(dobychaArr, rLen)
  for (let i = 0; i < rLen; i++) {
    const y = START_YEAR + i
    years.push({
      year: String(y),
      geologorazvedka: Math.round((GEOLOGORAZVEDKA[y] ?? 0) * STAGE_PEAK_SCALE.geologorazvedka * 1000) / 1000,
      razrabotka: Math.round(raz[i] * STAGE_PEAK_SCALE.razrabotka * 1000) / 1000,
      planirovanie: Math.round(pla[i] * STAGE_PEAK_SCALE.planirovanie * 1000) / 1000,
      burenie: Math.round(bur[i] * STAGE_PEAK_SCALE.burenie * 1000) / 1000,
      dobycha: Math.round(dob[i] * STAGE_PEAK_SCALE.dobycha * 1000) / 1000,
    })
  }
  return years
}
